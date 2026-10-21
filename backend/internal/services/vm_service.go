package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"iaas-dashboard/internal/database"
	"iaas-dashboard/internal/drivers"
	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type VMService struct {
	db            *sqlx.DB
	redis         *database.RedisClient
	driverFactory *drivers.DriverFactory
}

func NewVMService(db *sqlx.DB, redis *database.RedisClient, driverFactory *drivers.DriverFactory) *VMService {
	return &VMService{
		db:            db,
		redis:         redis,
		driverFactory: driverFactory,
	}
}

func (s *VMService) ListVMs(ctx context.Context, tenantID, userID uuid.UUID, role models.UserRole) ([]models.VirtualMachine, error) {
	var vms []models.VirtualMachine
	var query string
	var err error

	if role == models.RoleAdmin {
		// Admin sees all VMs across clusters with relational names
		query = `SELECT v.*, c.name as cluster_name, n.name as node_name, t.name as tenant_name 
                 FROM virtual_machines v
                 LEFT JOIN clusters c ON v.cluster_id = c.id
                 LEFT JOIN nodes n ON v.node_id = n.id
                 LEFT JOIN tenants t ON v.tenant_id = t.id
                 ORDER BY v.created_at DESC`
		err = s.db.SelectContext(ctx, &vms, query)
	} else {
		// Operator sees only VMs explicitly assigned to their user account
		query = `SELECT v.*, c.name as cluster_name, n.name as node_name, t.name as tenant_name 
                 FROM virtual_machines v
                 INNER JOIN user_vm_assignments a ON v.id = a.vm_id
                 LEFT JOIN clusters c ON v.cluster_id = c.id
                 LEFT JOIN nodes n ON v.node_id = n.id
                 LEFT JOIN tenants t ON v.tenant_id = t.id
                 WHERE a.user_id = $1
                 ORDER BY v.created_at DESC`
		err = s.db.SelectContext(ctx, &vms, query, userID)
	}

	return vms, err
}

func (s *VMService) GetVMByID(ctx context.Context, vmID uuid.UUID) (*models.VirtualMachine, error) {
	var vm models.VirtualMachine
	query := `SELECT v.*, c.name as cluster_name, n.name as node_name, t.name as tenant_name 
              FROM virtual_machines v
              LEFT JOIN clusters c ON v.cluster_id = c.id
              LEFT JOIN nodes n ON v.node_id = n.id
              LEFT JOIN tenants t ON v.tenant_id = t.id
              WHERE v.id = $1 LIMIT 1`

	err := s.db.GetContext(ctx, &vm, query, vmID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("virtual machine not found")
		}
		return nil, err
	}
	return &vm, nil
}

func (s *VMService) CreateVM(ctx context.Context, tenantID, userID uuid.UUID, req models.CreateVMRequest) (*models.VirtualMachine, error) {
	// 1. Check Tenant Quota
	var tenant models.Tenant
	err := s.db.GetContext(ctx, &tenant, `SELECT * FROM tenants WHERE id = $1`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("tenant not found: %w", err)
	}

	type usage struct {
		Count int `db:"count"`
		CPU   int `db:"cpu"`
		RAM   int `db:"ram"`
		Disk  int `db:"disk"`
	}
	var u usage
	_ = s.db.GetContext(ctx, &u, `SELECT COUNT(*) as count, COALESCE(SUM(cpu_cores), 0) as cpu, 
                                 COALESCE(SUM(ram_mb), 0) as ram, COALESCE(SUM(disk_gb), 0) as disk 
                                 FROM virtual_machines WHERE tenant_id = $1`, tenantID)

	if u.Count+1 > tenant.MaxVMs {
		return nil, fmt.Errorf("quota exceeded: maximum VM count limit (%d) reached", tenant.MaxVMs)
	}
	if u.CPU+req.CPUCores > tenant.MaxCPU {
		return nil, fmt.Errorf("quota exceeded: requested vCPU (%d) exceeds remaining quota (%d)", req.CPUCores, tenant.MaxCPU-u.CPU)
	}
	if (u.RAM+req.RAMMB)/1024 > tenant.MaxRAMGB {
		return nil, fmt.Errorf("quota exceeded: requested RAM exceeds tenant limit (%d GB)", tenant.MaxRAMGB)
	}

	// 2. Fetch Cluster & Node
	var cluster models.Cluster
	if err := s.db.GetContext(ctx, &cluster, `SELECT * FROM clusters WHERE id = $1`, req.ClusterID); err != nil {
		return nil, fmt.Errorf("target cluster not found: %w", err)
	}

	var node models.Node
	if err := s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 AND cluster_id = $2`, req.NodeID, req.ClusterID); err != nil {
		return nil, fmt.Errorf("target node not found in specified cluster: %w", err)
	}

	// 3. Invoke Hypervisor Driver
	driver := s.driverFactory.GetDriver(cluster.Type)
	vmid, ip, mac, err := driver.CreateVM(ctx, &cluster, &node, req)
	if err != nil {
		return nil, fmt.Errorf("hypervisor failed to provision VM: %w", err)
	}

	// 4. Save to DB
	vm := models.VirtualMachine{
		ID:             uuid.New(),
		TenantID:       tenantID,
		ClusterID:      cluster.ID,
		NodeID:         node.ID,
		HypervisorType: cluster.Type,
		Name:           req.Name,
		Status:         models.VMStatusRunning,
		CPUCores:       req.CPUCores,
		RAMMB:          req.RAMMB,
		DiskGB:         req.DiskGB,
		IPAddress:      ip,
		MACAddress:     mac,
		OSType:         req.OSType,
		ConsolePort:    5900 + (vmid % 100),
		VMID:           vmid,
		CreatedBy:      userID,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	insertQuery := `INSERT INTO virtual_machines 
        (id, tenant_id, cluster_id, node_id, hypervisor_type, name, status, cpu_cores, ram_mb, disk_gb, ip_address, mac_address, os_type, console_port, vmid, created_by, created_at, updated_at)
        VALUES (:id, :tenant_id, :cluster_id, :node_id, :hypervisor_type, :name, :status, :cpu_cores, :ram_mb, :disk_gb, :ip_address, :mac_address, :os_type, :console_port, :vmid, :created_by, :created_at, :updated_at)`

	_, err = s.db.NamedExecContext(ctx, insertQuery, vm)
	if err != nil {
		return nil, fmt.Errorf("failed to save VM record: %w", err)
	}

	// 5. Activity Log
	s.LogActivity(ctx, tenantID, &vm.ID, userID, "CREATE_VM", "SUCCESS", fmt.Sprintf("Provisioned VM '%s' on %s/%s", vm.Name, cluster.Name, node.Name))

	// 6. Pre-wire Metering sample for billing
	_, _ = s.db.ExecContext(ctx, `INSERT INTO resource_metering_samples (tenant_id, vm_id, cpu_cores, ram_mb, disk_gb, status) VALUES ($1, $2, $3, $4, $5, $6)`,
		tenantID, vm.ID, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.Status)

	return &vm, nil
}

func (s *VMService) UpdateVMSpecs(ctx context.Context, vmID, userID uuid.UUID, req models.UpdateVMRequest) (*models.VirtualMachine, error) {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, err
	}

	var cluster models.Cluster
	_ = s.db.GetContext(ctx, &cluster, `SELECT * FROM clusters WHERE id = $1`, vm.ClusterID)
	var node models.Node
	_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1`, vm.NodeID)

	driver := s.driverFactory.GetDriver(vm.HypervisorType)
	if err := driver.UpdateVMSpecs(ctx, &cluster, &node, vm.VMID, req); err != nil {
		return nil, fmt.Errorf("hypervisor spec reconfiguration failed: %w", err)
	}

	if req.Name != "" {
		vm.Name = req.Name
	}
	if req.CPUCores > 0 {
		vm.CPUCores = req.CPUCores
	}
	if req.RAMMB > 0 {
		vm.RAMMB = req.RAMMB
	}
	if req.DiskGB > 0 {
		vm.DiskGB = req.DiskGB
	}
	vm.UpdatedAt = time.Now()

	updateQuery := `UPDATE virtual_machines SET name = $1, cpu_cores = $2, ram_mb = $3, disk_gb = $4, updated_at = $5 WHERE id = $6`
	_, err = s.db.ExecContext(ctx, updateQuery, vm.Name, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.UpdatedAt, vm.ID)
	if err != nil {
		return nil, err
	}

	s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "EDIT_VM", "SUCCESS", fmt.Sprintf("Updated specs: %d vCPU, %d MB RAM, %d GB Disk", vm.CPUCores, vm.RAMMB, vm.DiskGB))

	return vm, nil
}

func (s *VMService) DeleteVM(ctx context.Context, vmID, userID uuid.UUID) error {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return err
	}

	var cluster models.Cluster
	_ = s.db.GetContext(ctx, &cluster, `SELECT * FROM clusters WHERE id = $1`, vm.ClusterID)
	var node models.Node
	_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1`, vm.NodeID)

	driver := s.driverFactory.GetDriver(vm.HypervisorType)
	_ = driver.DeleteVM(ctx, &cluster, &node, vm.VMID)

	_, err = s.db.ExecContext(ctx, `DELETE FROM virtual_machines WHERE id = $1`, vmID)
	if err != nil {
		return err
	}

	s.LogActivity(ctx, vm.TenantID, nil, userID, "DELETE_VM", "SUCCESS", fmt.Sprintf("Deleted VM '%s' (%s)", vm.Name, vm.ID))
	return nil
}

func (s *VMService) ExecutePowerAction(ctx context.Context, vmID, userID, tenantID uuid.UUID, role models.UserRole, action string, force bool) (*models.VirtualMachine, error) {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, err
	}

	// Operators can only manage VMs explicitly assigned to their account
	if role == models.RoleOperator {
		var isAssigned int
		_ = s.db.GetContext(ctx, &isAssigned, `SELECT COUNT(*) FROM user_vm_assignments WHERE user_id = $1 AND vm_id = $2`, userID, vmID)
		if isAssigned == 0 {
			return nil, errors.New("access denied: this virtual machine is not assigned to your operator account")
		}
	}

	// Redis Distributed Lock to prevent concurrent conflicting actions
	lockKey := fmt.Sprintf("vm:%s:power", vmID.String())
	locked, _ := s.redis.AcquireLock(ctx, lockKey, 10*time.Second)
	if !locked {
		return nil, errors.New("an operation is already in progress for this virtual machine")
	}
	defer s.redis.ReleaseLock(ctx, lockKey)

	var cluster models.Cluster
	_ = s.db.GetContext(ctx, &cluster, `SELECT * FROM clusters WHERE id = $1`, vm.ClusterID)
	var node models.Node
	_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1`, vm.NodeID)

	driver := s.driverFactory.GetDriver(vm.HypervisorType)

	var targetStatus models.VMStatus
	var logAction string

	switch action {
	case "start":
		if vm.Status == models.VMStatusRunning {
			return vm, nil // Already running
		}
		if err := driver.StartVM(ctx, &cluster, &node, vm.VMID); err != nil {
			return nil, err
		}
		targetStatus = models.VMStatusRunning
		logAction = "START_VM"

	case "stop":
		if vm.Status == models.VMStatusStopped {
			return vm, nil // Already stopped
		}
		if err := driver.StopVM(ctx, &cluster, &node, vm.VMID, force); err != nil {
			return nil, err
		}
		targetStatus = models.VMStatusStopped
		logAction = "STOP_VM"

	case "restart":
		if err := driver.RestartVM(ctx, &cluster, &node, vm.VMID); err != nil {
			return nil, err
		}
		targetStatus = models.VMStatusRunning
		logAction = "RESTART_VM"

	default:
		return nil, fmt.Errorf("unsupported power action: %s", action)
	}

	vm.Status = targetStatus
	vm.UpdatedAt = time.Now()
	_, err = s.db.ExecContext(ctx, `UPDATE virtual_machines SET status = $1, updated_at = $2 WHERE id = $3`, vm.Status, vm.UpdatedAt, vm.ID)
	if err != nil {
		return nil, err
	}

	s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, logAction, "SUCCESS", fmt.Sprintf("Executed %s on VM '%s'", action, vm.Name))
	return vm, nil
}

func (s *VMService) LogActivity(ctx context.Context, tenantID uuid.UUID, vmID *uuid.UUID, userID uuid.UUID, action, status, details string) {
	log := models.VMActivityLog{
		ID:        uuid.New(),
		TenantID:  tenantID,
		VMID:      vmID,
		UserID:    userID,
		Action:    action,
		Status:    status,
		Details:   details,
		CreatedAt: time.Now(),
	}
	_, _ = s.db.NamedExecContext(ctx, `INSERT INTO vm_activity_logs (id, tenant_id, vm_id, user_id, action, status, details, created_at)
        VALUES (:id, :tenant_id, :vm_id, :user_id, :action, :status, :details, :created_at)`, log)
}
