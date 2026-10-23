package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"iaas-dashboard/internal/database"
	"iaas-dashboard/internal/drivers"
	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ConsoleService struct {
	db            *sqlx.DB
	redis         *database.RedisClient
	driverFactory *drivers.DriverFactory
	vmService     *VMService
}

func NewConsoleService(db *sqlx.DB, redis *database.RedisClient, driverFactory *drivers.DriverFactory, vmService *VMService) *ConsoleService {
	return &ConsoleService{
		db:            db,
		redis:         redis,
		driverFactory: driverFactory,
		vmService:     vmService,
	}
}

func (s *ConsoleService) RequestConsoleTicket(ctx context.Context, vmID uuid.UUID, userID, tenantID uuid.UUID, role models.UserRole) (*models.ConsoleSessionResponse, error) {
	vm, err := s.vmService.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, err
	}

	// Operator role must only connect to their explicitly assigned VMs
	if role == models.RoleOperator {
		var isAssigned int
		_ = s.db.GetContext(ctx, &isAssigned, `SELECT COUNT(*) FROM user_vm_assignments WHERE user_id = $1 AND vm_id = $2`, userID, vmID)
		if isAssigned == 0 {
			return nil, errors.New("access denied: cannot access console of a virtual machine not assigned to you")
		}
	}

	if vm.Status != models.VMStatusRunning {
		return nil, errors.New("cannot open console: virtual machine is currently powered off or stopped")
	}

	var cluster models.Cluster
	query := `
		SELECT id, name, type, datacenter, endpoint, 
		       COALESCE(auth_user, '') as auth_user, 
		       COALESCE(auth_secret, '') as auth_secret, 
		       insecure_ssl, 
		       COALESCE(version, '') as version, 
		       status, total_cpu_cores, total_ram_gb, total_storage_tb, 
		       COALESCE(description, '') as description, 
		       created_at 
		FROM clusters WHERE id = $1
	`
	_ = s.db.GetContext(ctx, &cluster, query, vm.ClusterID)
	var node models.Node
	if vm.NodeID != "" {
		_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 OR cluster_id = $2 LIMIT 1`, vm.NodeID, cluster.ID)
	}
	if node.ID == "" {
		node.ID = vm.NodeID
	}

	driver := s.driverFactory.GetDriverForCluster(&cluster)
	connInfo, err := driver.GetConsoleTicket(ctx, &cluster, &node, vm.VMID, vm.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to generate hypervisor console ticket: %w", err)
	}

	// Cache ticket in Redis with 60 second expiration
	_ = s.redis.SetTicket(ctx, connInfo.Ticket, vm.ID.String(), 60*time.Second)

	// Log audit event
	s.vmService.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "OPEN_CONSOLE", "SUCCESS", fmt.Sprintf("Remote console ticket generated for VM '%s' (%s)", vm.Name, connInfo.Protocol))

	wsURL := fmt.Sprintf("/api/v1/vms/%s/console/ws?ticket=%s", vm.ID.String(), connInfo.Ticket)
	return &models.ConsoleSessionResponse{
		VMID:         vm.ID.String(),
		VMName:       vm.Name,
		Ticket:       connInfo.Ticket,
		Token:        connInfo.Ticket,
		WebSocketURL: wsURL,
		Protocol:     connInfo.Protocol,
		Host:         connInfo.TargetHost,
		Port:         connInfo.TargetPort,
	}, nil
}
