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
	_ = s.db.GetContext(ctx, &cluster, `SELECT * FROM clusters WHERE id = $1`, vm.ClusterID)
	var node models.Node
	_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1`, vm.NodeID)

	driver := s.driverFactory.GetDriver(vm.HypervisorType)
	connInfo, err := driver.GetConsoleTicket(ctx, &cluster, &node, vm.VMID, vm.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to generate hypervisor console ticket: %w", err)
	}

	// Cache ticket in Redis with 60 second expiration
	_ = s.redis.SetTicket(ctx, connInfo.Ticket, vm.ID.String(), 60*time.Second)

	// Log audit event
	s.vmService.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "OPEN_CONSOLE", "SUCCESS", fmt.Sprintf("Remote console ticket generated for VM '%s' (%s)", vm.Name, connInfo.Protocol))

	return &models.ConsoleSessionResponse{
		VMID:         vm.ID.String(),
		VMName:       vm.Name,
		Ticket:       connInfo.Ticket,
		WebSocketURL: connInfo.WebSocketURL,
		Protocol:     connInfo.Protocol,
		Host:         connInfo.TargetHost,
		Port:         connInfo.TargetPort,
	}, nil
}
