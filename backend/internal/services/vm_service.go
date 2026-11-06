package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
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
	svc := &VMService{
		db:            db,
		redis:         redis,
		driverFactory: driverFactory,
	}
	svc.EnsureBackupSchema(context.Background())
	return svc
}

func (s *VMService) EnsureBackupSchema(ctx context.Context) {
	migrations := []string{
		`ALTER TABLE virtual_machines ADD COLUMN IF NOT EXISTS backup_mode VARCHAR(20) DEFAULT 'NONE';`,
		`ALTER TABLE virtual_machines ADD COLUMN IF NOT EXISTS backup_provider VARCHAR(30) DEFAULT 'NONE';`,
		`ALTER TABLE virtual_machines ADD COLUMN IF NOT EXISTS backup_quota_gb INT DEFAULT 0;`,
		`ALTER TABLE virtual_machines ADD COLUMN IF NOT EXISTS backup_schedule VARCHAR(30) DEFAULT 'NONE';`,
		`ALTER TABLE virtual_machines ADD COLUMN IF NOT EXISTS last_backup_at TIMESTAMP WITH TIME ZONE;`,
		`CREATE TABLE IF NOT EXISTS vm_backups (
			id UUID PRIMARY KEY,
			vm_id UUID REFERENCES virtual_machines(id) ON DELETE CASCADE,
			tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
			cluster_id VARCHAR(50),
			node_id VARCHAR(50),
			vm_name VARCHAR(100) NOT NULL,
			vmid INT DEFAULT 0,
			hypervisor_type VARCHAR(20) NOT NULL,
			backup_provider VARCHAR(30) NOT NULL,
			backup_mode VARCHAR(20) NOT NULL,
			snapshot_name VARCHAR(180) NOT NULL,
			storage_repo VARCHAR(120) DEFAULT '',
			size_gb NUMERIC(10, 2) DEFAULT 0,
			compression VARCHAR(80) DEFAULT '',
			status VARCHAR(20) DEFAULT 'AVAILABLE',
			notes TEXT DEFAULT '',
			created_by UUID,
			created_by_name VARCHAR(100) DEFAULT '',
			restored_at TIMESTAMP WITH TIME ZONE,
			restore_count INT DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_vm_backups_vm ON vm_backups(vm_id);`,
		`CREATE INDEX IF NOT EXISTS idx_vm_backups_tenant ON vm_backups(tenant_id);`,
	}
	for _, m := range migrations {
		_, _ = s.db.ExecContext(ctx, m)
	}
}

func buildBackupSnapshotRecord(vm *models.VirtualMachine, bProvider, bMode, notes, username string, userID uuid.UUID) models.VMBackup {
	now := time.Now()
	tsCompact := now.Format("20060102-150405")
	pveTS := now.Format("2006_01_02-15_04_05")
	vmidNum := vm.VMID
	if vmidNum <= 0 {
		vmidNum = 100
	}

	diskGB := float64(vm.DiskGB)
	if diskGB <= 0 {
		diskGB = 50
	}

	var snapName, storageRepo, compression string
	var ratio float64

	switch strings.ToUpper(bProvider) {
	case "VEEAM":
		if bMode == "COLD" {
			snapName = fmt.Sprintf("veeam-vbr-cold-%s-vm%d-%s.vbk", strings.ToLower(vm.Name), vmidNum, tsCompact)
			storageRepo = "veeam-scaleout-archive-repo01"
			compression = "Veeam Extreme Compression + Full Consistent Archive (.vbk)"
			ratio = 0.44
		} else {
			snapName = fmt.Sprintf("veeam-vbr-cbt-warm-%s-vm%d-%s.vib", strings.ToLower(vm.Name), vmidNum, tsCompact)
			storageRepo = "veeam-sobr-performance-tier01"
			compression = "Veeam FastLZ + vSphere CBT Live Snapshot (.vib)"
			ratio = 0.30
		}
	case "NETAPP":
		if bMode == "COLD" {
			snapName = fmt.Sprintf("netapp-snapvault-cold-vm%d-%s", vmidNum, tsCompact)
			storageRepo = "netapp-ontap-svm01:snapvault_archive"
			compression = "NetApp ONTAP WAFL Dedup + SnapVault Quiesced Archive"
			ratio = 0.42
		} else {
			snapName = fmt.Sprintf("netapp-snapmirror-warm-vm%d-%s", vmidNum, tsCompact)
			storageRepo = "netapp-ontap-svm01:snapmirror_primary"
			compression = "NetApp SnapCenter Live Snapshot + WAFL Inline Dedup"
			ratio = 0.28
		}
	default:
		bProvider = "PBS"
		if bMode == "COLD" {
			snapName = fmt.Sprintf("pbs:backup/vzdump-qemu-%d-%s.vma.zst", vmidNum, pveTS)
			storageRepo = "pbs-datastore-01 (PBS Cold Archive)"
			compression = "ZSTD Max + PBS SHA-256 Chunk Deduplication (Stop Mode)"
			ratio = 0.45
		} else {
			snapName = fmt.Sprintf("pbs:backup/vzdump-qemu-%d-%s.vma.zst", vmidNum, pveTS)
			storageRepo = "pbs-datastore-01 (PBS Live Repo)"
			compression = "ZSTD Fast + Dirty-Bitmap Live Incremental (Zero Downtime)"
			ratio = 0.32
		}
	}

	sizeGB := math.Round(diskGB*ratio*100) / 100
	if sizeGB < 1.25 {
		sizeGB = 1.25
	}

	cleanNotes := strings.TrimSpace(notes)
	if cleanNotes == "" {
		if bMode == "COLD" {
			cleanNotes = fmt.Sprintf("%s Cold Backup (Offline Consistent Archive)", bProvider)
		} else {
			cleanNotes = fmt.Sprintf("%s Warm Backup (Live Zero-Downtime Snapshot)", bProvider)
		}
	}

	if username == "" {
		username = "System / Operator"
	}

	return models.VMBackup{
		ID:             uuid.New(),
		VMIDRef:        vm.ID,
		TenantID:       vm.TenantID,
		ClusterID:      vm.ClusterID,
		NodeID:         vm.NodeID,
		VMName:         vm.Name,
		VMID:           vm.VMID,
		HypervisorType: string(vm.HypervisorType),
		BackupProvider: bProvider,
		BackupMode:     bMode,
		SnapshotName:   snapName,
		StorageRepo:    storageRepo,
		SizeGB:         sizeGB,
		Compression:    compression,
		Status:         "AVAILABLE",
		Notes:          cleanNotes,
		CreatedBy:      &userID,
		CreatedByName:  username,
		RestoreCount:   0,
		CreatedAt:      now,
	}
}

func resolveBackupConfig(hypervisorType models.HypervisorType, mode string, requestedProvider string, quotaGB, diskGB int, schedule string) (string, string, int, string) {
	cleanMode := strings.ToUpper(strings.TrimSpace(mode))
	if cleanMode != "WARM" && cleanMode != "COLD" {
		return "NONE", "NONE", 0, "NONE"
	}

	provider := "PBS"
	if hypervisorType == models.HypervisorVMware {
		reqProv := strings.ToUpper(strings.TrimSpace(requestedProvider))
		if reqProv == "VEEAM" {
			provider = "VEEAM"
		} else {
			provider = "NETAPP"
		}
	}

	if quotaGB <= 0 {
		quotaGB = diskGB
	}

	cleanSched := strings.ToUpper(strings.TrimSpace(schedule))
	if cleanSched != "DAILY" && cleanSched != "WEEKLY" && cleanSched != "MANUAL" {
		if cleanMode == "WARM" {
			cleanSched = "DAILY"
		} else {
			cleanSched = "WEEKLY"
		}
	}

	return cleanMode, provider, quotaGB, cleanSched
}

func (s *VMService) ListVMs(ctx context.Context, tenantID, userID uuid.UUID, role models.UserRole) ([]models.VirtualMachine, error) {
	s.EnsureBackupSchema(ctx)
	var vms []models.VirtualMachine
	var query string
	var err error

	if role == models.RoleAdmin {
		query = `SELECT v.id, v.tenant_id, v.cluster_id, v.node_id, v.hypervisor_type, v.name, v.status,
		                v.cpu_cores, v.ram_mb, v.disk_gb,
		                COALESCE(v.ip_address, '') as ip_address,
		                COALESCE(v.mac_address, '') as mac_address,
		                COALESCE(v.os_type, 'Ubuntu') as os_type,
		                COALESCE(v.console_port, 0) as console_port,
		                COALESCE(v.vmid, 0) as vmid,
		                COALESCE(v.backup_mode, 'NONE') as backup_mode,
		                COALESCE(v.backup_provider, 'NONE') as backup_provider,
		                COALESCE(v.backup_quota_gb, 0) as backup_quota_gb,
		                COALESCE(v.backup_schedule, 'NONE') as backup_schedule,
		                v.last_backup_at,
		                v.created_by, v.created_at, v.updated_at,
		                c.name as cluster_name, n.name as node_name, t.name as tenant_name,
		                (SELECT COUNT(*) FROM vm_backups b WHERE b.vm_id = v.id) as backup_count
                 FROM virtual_machines v
                 LEFT JOIN clusters c ON v.cluster_id = c.id
                 LEFT JOIN nodes n ON v.node_id = n.id
                 LEFT JOIN tenants t ON v.tenant_id = t.id
                 ORDER BY v.created_at DESC`
		err = s.db.SelectContext(ctx, &vms, query)
	} else {
		query = `SELECT DISTINCT v.id, v.tenant_id, v.cluster_id, v.node_id, v.hypervisor_type, v.name, v.status,
		                v.cpu_cores, v.ram_mb, v.disk_gb,
		                COALESCE(v.ip_address, '') as ip_address,
		                COALESCE(v.mac_address, '') as mac_address,
		                COALESCE(v.os_type, 'Ubuntu') as os_type,
		                COALESCE(v.console_port, 0) as console_port,
		                COALESCE(v.vmid, 0) as vmid,
		                COALESCE(v.backup_mode, 'NONE') as backup_mode,
		                COALESCE(v.backup_provider, 'NONE') as backup_provider,
		                COALESCE(v.backup_quota_gb, 0) as backup_quota_gb,
		                COALESCE(v.backup_schedule, 'NONE') as backup_schedule,
		                v.last_backup_at,
		                v.created_by, v.created_at, v.updated_at,
		                c.name as cluster_name, n.name as node_name, t.name as tenant_name,
		                (SELECT COUNT(*) FROM vm_backups b WHERE b.vm_id = v.id) as backup_count
                 FROM virtual_machines v
                 INNER JOIN user_vm_assignments a ON v.id = a.vm_id
                 LEFT JOIN clusters c ON v.cluster_id = c.id
                 LEFT JOIN nodes n ON v.node_id = n.id
                 LEFT JOIN tenants t ON v.tenant_id = t.id
                 WHERE a.user_id = $1
                 ORDER BY v.created_at DESC`
		err = s.db.SelectContext(ctx, &vms, query, userID)
		if vms == nil {
			vms = []models.VirtualMachine{}
		}
	}

	return vms, err
}

func (s *VMService) GetVMByID(ctx context.Context, vmID uuid.UUID) (*models.VirtualMachine, error) {
	s.EnsureBackupSchema(ctx)
	var vm models.VirtualMachine
	query := `SELECT v.id, v.tenant_id, v.cluster_id, v.node_id, v.hypervisor_type, v.name, v.status,
	                v.cpu_cores, v.ram_mb, v.disk_gb,
	                COALESCE(v.ip_address, '') as ip_address,
	                COALESCE(v.mac_address, '') as mac_address,
	                COALESCE(v.os_type, 'Ubuntu') as os_type,
	                COALESCE(v.console_port, 0) as console_port,
	                COALESCE(v.vmid, 0) as vmid,
	                COALESCE(v.backup_mode, 'NONE') as backup_mode,
	                COALESCE(v.backup_provider, 'NONE') as backup_provider,
	                COALESCE(v.backup_quota_gb, 0) as backup_quota_gb,
	                COALESCE(v.backup_schedule, 'NONE') as backup_schedule,
	                v.last_backup_at,
	                v.created_by, v.created_at, v.updated_at,
	                c.name as cluster_name, n.name as node_name, t.name as tenant_name,
	                (SELECT COUNT(*) FROM vm_backups b WHERE b.vm_id = v.id) as backup_count
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

func (s *VMService) GetVMByVMID(ctx context.Context, vmid int) (*models.VirtualMachine, error) {
	s.EnsureBackupSchema(ctx)
	var vm models.VirtualMachine
	query := `SELECT v.id, v.tenant_id, v.cluster_id, v.node_id, v.hypervisor_type, v.name, v.status,
	                v.cpu_cores, v.ram_mb, v.disk_gb,
	                COALESCE(v.ip_address, '') as ip_address,
	                COALESCE(v.mac_address, '') as mac_address,
	                COALESCE(v.os_type, 'Ubuntu') as os_type,
	                COALESCE(v.console_port, 0) as console_port,
	                COALESCE(v.vmid, 0) as vmid,
	                COALESCE(v.backup_mode, 'NONE') as backup_mode,
	                COALESCE(v.backup_provider, 'NONE') as backup_provider,
	                COALESCE(v.backup_quota_gb, 0) as backup_quota_gb,
	                COALESCE(v.backup_schedule, 'NONE') as backup_schedule,
	                v.last_backup_at,
	                v.created_by, v.created_at, v.updated_at,
	                c.name as cluster_name, n.name as node_name, t.name as tenant_name,
	                (SELECT COUNT(*) FROM vm_backups b WHERE b.vm_id = v.id) as backup_count
              FROM virtual_machines v
              LEFT JOIN clusters c ON v.cluster_id = c.id
              LEFT JOIN nodes n ON v.node_id = n.id
              LEFT JOIN tenants t ON v.tenant_id = t.id
              WHERE v.vmid = $1 LIMIT 1`

	err := s.db.GetContext(ctx, &vm, query, vmid)
	if err != nil {
		return nil, err
	}
	return &vm, nil
}

func (s *VMService) GetAnyActiveVM(ctx context.Context) (*models.VirtualMachine, error) {
	s.EnsureBackupSchema(ctx)
	var vm models.VirtualMachine
	query := `SELECT v.id, v.tenant_id, v.cluster_id, v.node_id, v.hypervisor_type, v.name, v.status,
	                v.cpu_cores, v.ram_mb, v.disk_gb,
	                COALESCE(v.ip_address, '') as ip_address,
	                COALESCE(v.mac_address, '') as mac_address,
	                COALESCE(v.os_type, 'Ubuntu') as os_type,
	                COALESCE(v.console_port, 0) as console_port,
	                COALESCE(v.vmid, 0) as vmid,
	                COALESCE(v.backup_mode, 'NONE') as backup_mode,
	                COALESCE(v.backup_provider, 'NONE') as backup_provider,
	                COALESCE(v.backup_quota_gb, 0) as backup_quota_gb,
	                COALESCE(v.backup_schedule, 'NONE') as backup_schedule,
	                v.last_backup_at,
	                v.created_by, v.created_at, v.updated_at,
	                c.name as cluster_name, n.name as node_name, t.name as tenant_name,
	                (SELECT COUNT(*) FROM vm_backups b WHERE b.vm_id = v.id) as backup_count
              FROM virtual_machines v
              LEFT JOIN clusters c ON v.cluster_id = c.id
              LEFT JOIN nodes n ON v.node_id = n.id
              LEFT JOIN tenants t ON v.tenant_id = t.id
              ORDER BY (v.status = 'RUNNING') DESC, v.updated_at DESC LIMIT 1`

	err := s.db.GetContext(ctx, &vm, query)
	if err != nil {
		return nil, err
	}
	return &vm, nil
}

func (s *VMService) getClusterSafely(ctx context.Context, clusterID string) (*models.Cluster, error) {
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
	if err := s.db.GetContext(ctx, &cluster, query, clusterID); err != nil {
		return nil, err
	}
	return &cluster, nil
}

func (s *VMService) CreateVM(ctx context.Context, tenantID, userID uuid.UUID, req models.CreateVMRequest) (*models.VirtualMachine, error) {
	s.EnsureBackupSchema(ctx)

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
		return nil, fmt.Errorf("quota exceeded: tenant maximum VM limit (%d) reached", tenant.MaxVMs)
	}
	if u.CPU+req.CPUCores > tenant.MaxCPU {
		return nil, fmt.Errorf("quota exceeded: requested vCPU exceeds tenant limit (%d cores)", tenant.MaxCPU)
	}
	if (u.RAM+req.RAMMB)/1024 > tenant.MaxRAMGB {
		return nil, fmt.Errorf("quota exceeded: requested RAM exceeds tenant limit (%d GB)", tenant.MaxRAMGB)
	}

	// 2. Fetch Cluster & Node
	cluster, err := s.getClusterSafely(ctx, req.ClusterID)
	if err != nil {
		return nil, fmt.Errorf("target cluster not found: %w", err)
	}

	var node models.Node
	if err := s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 AND cluster_id = $2`, req.NodeID, req.ClusterID); err != nil {
		return nil, fmt.Errorf("target node not found in specified cluster: %w", err)
	}

	// 3. Invoke Hypervisor Driver
	driver := s.driverFactory.GetDriverForCluster(cluster)
	vmid, ip, mac, err := driver.CreateVM(ctx, cluster, &node, req)
	if err != nil {
		return nil, fmt.Errorf("hypervisor failed to provision VM: %w", err)
	}

	// 4. Resolve Add-On Backup Configuration (Proxmox -> PBS, VMware -> NETAPP or VEEAM)
	bMode, bProvider, bQuota, bSched := resolveBackupConfig(cluster.Type, req.BackupMode, req.BackupProvider, req.BackupQuotaGB, req.DiskGB, req.BackupSchedule)

	// 5. Save to DB
	vm := models.VirtualMachine{
		ID:             uuid.New(),
		TenantID:       tenantID,
		ClusterID:      cluster.ID,
		NodeID:         node.ID,
		HypervisorType: cluster.Type,
		Name:           req.Name,
		Status:         models.VMStatusStopped,
		CPUCores:       req.CPUCores,
		RAMMB:          req.RAMMB,
		DiskGB:         req.DiskGB,
		IPAddress:      ip,
		MACAddress:     mac,
		OSType:         req.OSType,
		ConsolePort:    5900 + (vmid % 100),
		VMID:           vmid,
		BackupMode:     bMode,
		BackupProvider: bProvider,
		BackupQuotaGB:  bQuota,
		BackupSchedule: bSched,
		CreatedBy:      &userID,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	insertQuery := `INSERT INTO virtual_machines 
        (id, tenant_id, cluster_id, node_id, hypervisor_type, name, status, cpu_cores, ram_mb, disk_gb, ip_address, mac_address, os_type, console_port, vmid, backup_mode, backup_provider, backup_quota_gb, backup_schedule, created_by, created_at, updated_at)
        VALUES (:id, :tenant_id, :cluster_id, :node_id, :hypervisor_type, :name, :status, :cpu_cores, :ram_mb, :disk_gb, :ip_address, :mac_address, :os_type, :console_port, :vmid, :backup_mode, :backup_provider, :backup_quota_gb, :backup_schedule, :created_by, :created_at, :updated_at)`

	_, err = s.db.NamedExecContext(ctx, insertQuery, vm)
	if err != nil {
		return nil, fmt.Errorf("failed to save VM record: %w", err)
	}

	// 6. If Backup Add-On is enabled, automatically create initial baseline backup snapshot (unless explicitly disabled)
	createInitBackup := true
	if req.CreateInitialBackup != nil {
		createInitBackup = *req.CreateInitialBackup
	}
	if bMode != "NONE" && createInitBackup {
		var username string
		_ = s.db.GetContext(ctx, &username, `SELECT username FROM users WHERE id = $1`, userID)
		driverMode := bMode
		if vm.HypervisorType == models.HypervisorVMware {
			driverMode = bProvider + ":" + bMode
		}
		_, _ = driver.TriggerBackup(ctx, cluster, &node, vm.VMID, vm.Name, driverMode)

		initBackup := buildBackupSnapshotRecord(&vm, bProvider, bMode, fmt.Sprintf("Initial Add-On %s Backup saat Provisioning VM", bMode), username, userID)
		_, _ = s.insertBackupRecord(ctx, initBackup)
		now := time.Now()
		vm.LastBackupAt = &now
		vm.BackupCount = 1
		_, _ = s.db.ExecContext(ctx, `UPDATE virtual_machines SET last_backup_at = $1 WHERE id = $2`, now, vm.ID)
	}

	// 7. Activity Log
	backupDetail := "No Backup Add-On"
	if bMode != "NONE" {
		backupDetail = fmt.Sprintf("Backup Add-On: %s (%s, %d GB, %s)", bProvider, bMode, bQuota, bSched)
	}
	s.LogActivity(ctx, tenantID, &vm.ID, userID, "CREATE_VM", "SUCCESS", fmt.Sprintf("Provisioned VM '%s' on %s/%s [%s]", vm.Name, cluster.Name, node.Name, backupDetail))

	// 8. Pre-wire Metering sample for billing
	_, _ = s.db.ExecContext(ctx, `INSERT INTO resource_metering_samples (tenant_id, vm_id, cpu_cores, ram_mb, disk_gb, status) VALUES ($1, $2, $3, $4, $5, $6)`,
		tenantID, vm.ID, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.Status)

	return &vm, nil
}

func (s *VMService) insertBackupRecord(ctx context.Context, b models.VMBackup) (*models.VMBackup, error) {
	query := `INSERT INTO vm_backups 
		(id, vm_id, tenant_id, cluster_id, node_id, vm_name, vmid, hypervisor_type, backup_provider, backup_mode, snapshot_name, storage_repo, size_gb, compression, status, notes, created_by, created_by_name, restore_count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`
	_, err := s.db.ExecContext(ctx, query,
		b.ID, b.VMIDRef, b.TenantID, b.ClusterID, b.NodeID, b.VMName, b.VMID, b.HypervisorType,
		b.BackupProvider, b.BackupMode, b.SnapshotName, b.StorageRepo, b.SizeGB, b.Compression,
		b.Status, b.Notes, b.CreatedBy, b.CreatedByName, b.RestoreCount, b.CreatedAt,
	)
	return &b, err
}

func (s *VMService) UpdateVMSpecs(ctx context.Context, vmID, userID uuid.UUID, req models.UpdateVMRequest) (*models.VirtualMachine, error) {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, err
	}

	cluster, _ := s.getClusterSafely(ctx, vm.ClusterID)
	var node models.Node
	_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1`, vm.NodeID)

	driver := s.driverFactory.GetDriverForCluster(cluster)
	if err := driver.UpdateVMSpecs(ctx, cluster, &node, vm.VMID, req); err != nil {
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

	if req.BackupMode != "" {
		reqProv := req.BackupProvider
		if reqProv == "" {
			reqProv = vm.BackupProvider
		}
		bMode, bProvider, bQuota, bSched := resolveBackupConfig(vm.HypervisorType, req.BackupMode, reqProv, req.BackupQuotaGB, vm.DiskGB, req.BackupSchedule)
		vm.BackupMode = bMode
		vm.BackupProvider = bProvider
		vm.BackupQuotaGB = bQuota
		vm.BackupSchedule = bSched
	}

	vm.UpdatedAt = time.Now()

	updateQuery := `UPDATE virtual_machines SET name = $1, cpu_cores = $2, ram_mb = $3, disk_gb = $4, backup_mode = $5, backup_provider = $6, backup_quota_gb = $7, backup_schedule = $8, updated_at = $9 WHERE id = $10`
	_, err = s.db.ExecContext(ctx, updateQuery, vm.Name, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.BackupMode, vm.BackupProvider, vm.BackupQuotaGB, vm.BackupSchedule, vm.UpdatedAt, vm.ID)
	if err != nil {
		return nil, err
	}

	s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "EDIT_VM", "SUCCESS", fmt.Sprintf("Updated specs: %d vCPU, %d MB RAM, %d GB Disk, Backup: %s (%s)", vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.BackupMode, vm.BackupProvider))

	return vm, nil
}

func (s *VMService) ExecuteBackup(ctx context.Context, vmID, userID, tenantID uuid.UUID, role models.UserRole, req models.TriggerBackupRequest) (*models.VirtualMachine, *models.VMBackup, string, error) {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, nil, "", err
	}

	if role == models.RoleOperator {
		hasAccess, err := s.CheckOperatorVMAccess(ctx, userID, vmID)
		if err != nil || !hasAccess {
			return nil, nil, "", errors.New("access denied: this virtual machine is not assigned to your operator account")
		}
	}

	backupMode := vm.BackupMode
	if strings.TrimSpace(req.BackupMode) != "" {
		backupMode = strings.ToUpper(strings.TrimSpace(req.BackupMode))
	}
	if backupMode != "WARM" && backupMode != "COLD" {
		backupMode = "WARM"
	}

	requestedProvider := vm.BackupProvider
	if strings.TrimSpace(req.BackupProvider) != "" {
		requestedProvider = strings.ToUpper(strings.TrimSpace(req.BackupProvider))
	}

	bMode, bProvider, bQuota, bSched := resolveBackupConfig(vm.HypervisorType, backupMode, requestedProvider, vm.BackupQuotaGB, vm.DiskGB, vm.BackupSchedule)

	cluster, err := s.getClusterSafely(ctx, vm.ClusterID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("cluster '%s' not found for VM: %w", vm.ClusterID, err)
	}
	var node models.Node
	if vm.NodeID != "" {
		_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 OR cluster_id = $2 LIMIT 1`, vm.NodeID, cluster.ID)
	}
	if node.ID == "" {
		node.ID = vm.NodeID
	}

	driver := s.driverFactory.GetDriverForCluster(cluster)
	driverMode := bMode
	if vm.HypervisorType == models.HypervisorVMware {
		driverMode = bProvider + ":" + bMode
	}
	msg, err := driver.TriggerBackup(ctx, cluster, &node, vm.VMID, vm.Name, driverMode)
	if err != nil {
		s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "BACKUP_VM", "FAILED", fmt.Sprintf("Failed %s %s backup on '%s': %v", bProvider, bMode, vm.Name, err))
		return nil, nil, "", err
	}

	var username string
	_ = s.db.GetContext(ctx, &username, `SELECT username FROM users WHERE id = $1`, userID)

	backupRec := buildBackupSnapshotRecord(vm, bProvider, bMode, req.Notes, username, userID)
	savedBackup, _ := s.insertBackupRecord(ctx, backupRec)

	now := time.Now()
	vm.BackupMode = bMode
	vm.BackupProvider = bProvider
	vm.BackupQuotaGB = bQuota
	vm.BackupSchedule = bSched
	vm.LastBackupAt = &now
	vm.BackupCount++
	vm.UpdatedAt = now

	_, _ = s.db.ExecContext(ctx, `UPDATE virtual_machines SET backup_mode = $1, backup_provider = $2, backup_quota_gb = $3, backup_schedule = $4, last_backup_at = $5, updated_at = $6 WHERE id = $7`,
		vm.BackupMode, vm.BackupProvider, vm.BackupQuotaGB, vm.BackupSchedule, vm.LastBackupAt, vm.UpdatedAt, vm.ID)

	s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "BACKUP_VM", "SUCCESS", fmt.Sprintf("%s [Snapshot: %s]", msg, backupRec.SnapshotName))
	return vm, savedBackup, msg, nil
}

func (s *VMService) ListVMBackups(ctx context.Context, vmID, userID, tenantID uuid.UUID, role models.UserRole) ([]models.VMBackup, error) {
	s.EnsureBackupSchema(ctx)
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, err
	}

	if role == models.RoleOperator {
		if vm.TenantID != tenantID {
			return nil, errors.New("access denied: cannot view backups of another tenant")
		}
		hasAccess, err := s.CheckOperatorVMAccess(ctx, userID, vmID)
		if err != nil || !hasAccess {
			return nil, errors.New("access denied: this virtual machine is not assigned to your operator account")
		}
	}

	var backups []models.VMBackup
	query := `SELECT id, vm_id, tenant_id, COALESCE(cluster_id, '') as cluster_id, COALESCE(node_id, '') as node_id,
	                 vm_name, COALESCE(vmid, 0) as vmid, hypervisor_type, backup_provider, backup_mode,
	                 snapshot_name, COALESCE(storage_repo, '') as storage_repo, COALESCE(size_gb, 0) as size_gb,
	                 COALESCE(compression, '') as compression, COALESCE(status, 'AVAILABLE') as status,
	                 COALESCE(notes, '') as notes, created_by, COALESCE(created_by_name, 'System') as created_by_name,
	                 restored_at, COALESCE(restore_count, 0) as restore_count, created_at
	          FROM vm_backups
	          WHERE vm_id = $1
	          ORDER BY created_at DESC`
	if err := s.db.SelectContext(ctx, &backups, query, vmID); err != nil {
		return []models.VMBackup{}, err
	}
	if backups == nil {
		backups = []models.VMBackup{}
	}
	return backups, nil
}

func (s *VMService) ListAllAccessibleBackups(ctx context.Context, userID, tenantID uuid.UUID, role models.UserRole) ([]models.VMBackup, error) {
	s.EnsureBackupSchema(ctx)
	var backups []models.VMBackup
	var err error

	if role == models.RoleAdmin {
		query := `SELECT b.id, b.vm_id, b.tenant_id, COALESCE(b.cluster_id, '') as cluster_id, COALESCE(b.node_id, '') as node_id,
		                 b.vm_name, COALESCE(b.vmid, 0) as vmid, b.hypervisor_type, b.backup_provider, b.backup_mode,
		                 b.snapshot_name, COALESCE(b.storage_repo, '') as storage_repo, COALESCE(b.size_gb, 0) as size_gb,
		                 COALESCE(b.compression, '') as compression, COALESCE(b.status, 'AVAILABLE') as status,
		                 COALESCE(b.notes, '') as notes, b.created_by, COALESCE(b.created_by_name, 'System') as created_by_name,
		                 b.restored_at, COALESCE(b.restore_count, 0) as restore_count, b.created_at
		          FROM vm_backups b
		          ORDER BY b.created_at DESC`
		err = s.db.SelectContext(ctx, &backups, query)
	} else {
		query := `SELECT DISTINCT b.id, b.vm_id, b.tenant_id, COALESCE(b.cluster_id, '') as cluster_id, COALESCE(b.node_id, '') as node_id,
		                 b.vm_name, COALESCE(b.vmid, 0) as vmid, b.hypervisor_type, b.backup_provider, b.backup_mode,
		                 b.snapshot_name, COALESCE(b.storage_repo, '') as storage_repo, COALESCE(b.size_gb, 0) as size_gb,
		                 COALESCE(b.compression, '') as compression, COALESCE(b.status, 'AVAILABLE') as status,
		                 COALESCE(b.notes, '') as notes, b.created_by, COALESCE(b.created_by_name, 'System') as created_by_name,
		                 b.restored_at, COALESCE(b.restore_count, 0) as restore_count, b.created_at
		          FROM vm_backups b
		          INNER JOIN user_vm_assignments a ON b.vm_id = a.vm_id
		          WHERE a.user_id = $1
		          ORDER BY b.created_at DESC`
		err = s.db.SelectContext(ctx, &backups, query, userID)
	}
	if backups == nil {
		backups = []models.VMBackup{}
	}
	return backups, err
}

func (s *VMService) RestoreVMBackup(ctx context.Context, vmID, backupID, userID, tenantID uuid.UUID, role models.UserRole, req models.RestoreBackupRequest) (*models.VirtualMachine, *models.VMBackup, string, error) {
	s.EnsureBackupSchema(ctx)
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, nil, "", err
	}

	if role == models.RoleOperator {
		if vm.TenantID != tenantID {
			return nil, nil, "", errors.New("access denied: cannot restore VM of another tenant")
		}
		hasAccess, err := s.CheckOperatorVMAccess(ctx, userID, vmID)
		if err != nil || !hasAccess {
			return nil, nil, "", errors.New("access denied: this virtual machine is not assigned to your operator account")
		}
	}

	var backup models.VMBackup
	query := `SELECT id, vm_id, tenant_id, COALESCE(cluster_id, '') as cluster_id, COALESCE(node_id, '') as node_id,
	                 vm_name, COALESCE(vmid, 0) as vmid, hypervisor_type, backup_provider, backup_mode,
	                 snapshot_name, COALESCE(storage_repo, '') as storage_repo, COALESCE(size_gb, 0) as size_gb,
	                 COALESCE(compression, '') as compression, COALESCE(status, 'AVAILABLE') as status,
	                 COALESCE(notes, '') as notes, created_by, COALESCE(created_by_name, 'System') as created_by_name,
	                 restored_at, COALESCE(restore_count, 0) as restore_count, created_at
	          FROM vm_backups WHERE id = $1 AND vm_id = $2 LIMIT 1`
	if err := s.db.GetContext(ctx, &backup, query, backupID, vmID); err != nil {
		return nil, nil, "", errors.New("backup snapshot not found for this virtual machine")
	}

	lockKey := fmt.Sprintf("vm:%s:power", vmID.String())
	locked, _ := s.redis.AcquireLock(ctx, lockKey, 20*time.Second)
	if !locked {
		return nil, nil, "", errors.New("an operation is already in progress for this virtual machine")
	}
	defer s.redis.ReleaseLock(ctx, lockKey)

	cluster, err := s.getClusterSafely(ctx, vm.ClusterID)
	if err != nil {
		return nil, nil, "", fmt.Errorf("cluster '%s' not found for VM: %w", vm.ClusterID, err)
	}
	var node models.Node
	if vm.NodeID != "" {
		_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 OR cluster_id = $2 LIMIT 1`, vm.NodeID, cluster.ID)
	}
	if node.ID == "" {
		node.ID = vm.NodeID
	}

	driver := s.driverFactory.GetDriverForCluster(cluster)
	msg, err := driver.RestoreBackup(ctx, cluster, &node, vm.VMID, vm.Name, &backup, req.StartAfter)
	if err != nil {
		s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "RESTORE_VM", "FAILED", fmt.Sprintf("Failed to restore '%s' from %s (%s): %v", vm.Name, backup.SnapshotName, backup.BackupProvider, err))
		return nil, nil, "", err
	}

	now := time.Now()
	if req.StartAfter {
		vm.Status = models.VMStatusRunning
	} else {
		vm.Status = models.VMStatusStopped
	}
	vm.UpdatedAt = now
	_, _ = s.db.ExecContext(ctx, `UPDATE virtual_machines SET status = $1, updated_at = $2 WHERE id = $3`, vm.Status, vm.UpdatedAt, vm.ID)

	backup.RestoredAt = &now
	backup.RestoreCount++
	_, _ = s.db.ExecContext(ctx, `UPDATE vm_backups SET restored_at = $1, restore_count = $2 WHERE id = $3`, now, backup.RestoreCount, backup.ID)

	s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "RESTORE_VM", "SUCCESS", msg)
	return vm, &backup, msg, nil
}

func (s *VMService) DeleteVMBackup(ctx context.Context, vmID, backupID, userID, tenantID uuid.UUID, role models.UserRole) error {
	s.EnsureBackupSchema(ctx)
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return err
	}

	if role == models.RoleOperator {
		if vm.TenantID != tenantID {
			return errors.New("access denied: cannot delete backup of another tenant")
		}
		hasAccess, err := s.CheckOperatorVMAccess(ctx, userID, vmID)
		if err != nil || !hasAccess {
			return errors.New("access denied: this virtual machine is not assigned to your operator account")
		}
	}

	var snapName string
	_ = s.db.GetContext(ctx, &snapName, `SELECT snapshot_name FROM vm_backups WHERE id = $1 AND vm_id = $2`, backupID, vmID)
	if snapName == "" {
		return errors.New("backup snapshot not found")
	}

	_, err = s.db.ExecContext(ctx, `DELETE FROM vm_backups WHERE id = $1 AND vm_id = $2`, backupID, vmID)
	if err != nil {
		return err
	}

	s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "DELETE_BACKUP", "SUCCESS", fmt.Sprintf("Removed backup snapshot '%s' from VM '%s'", snapName, vm.Name))
	return nil
}

func (s *VMService) DeleteVM(ctx context.Context, vmID, userID uuid.UUID) error {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return err
	}

	cluster, _ := s.getClusterSafely(ctx, vm.ClusterID)
	var node models.Node
	_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1`, vm.NodeID)

	driver := s.driverFactory.GetDriverForCluster(cluster)
	_ = driver.DeleteVM(ctx, cluster, &node, vm.VMID)

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

	// Operators can ONLY manage explicitly assigned VMs
	if role == models.RoleOperator {
		hasAccess, err := s.CheckOperatorVMAccess(ctx, userID, vmID)
		if err != nil || !hasAccess {
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

	cluster, err := s.getClusterSafely(ctx, vm.ClusterID)
	if err != nil {
		return nil, fmt.Errorf("cluster '%s' not found for VM: %w", vm.ClusterID, err)
	}
	var node models.Node
	if vm.NodeID != "" {
		_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 OR cluster_id = $2 LIMIT 1`, vm.NodeID, cluster.ID)
	}
	if node.ID == "" {
		node.ID = vm.NodeID
	}

	driver := s.driverFactory.GetDriverForCluster(cluster)

	var targetStatus models.VMStatus
	var logAction string

	switch strings.ToLower(strings.TrimSpace(action)) {
	case "start":
		if err := driver.StartVM(ctx, cluster, &node, vm.VMID); err != nil {
			return nil, err
		}
		targetStatus = models.VMStatusRunning
		logAction = "START_VM"

	case "stop":
		if err := driver.StopVM(ctx, cluster, &node, vm.VMID, force); err != nil {
			return nil, err
		}
		targetStatus = models.VMStatusStopped
		logAction = "STOP_VM"

	case "restart":
		if err := driver.RestartVM(ctx, cluster, &node, vm.VMID); err != nil {
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

func (s *VMService) RebuildVM(ctx context.Context, vmID, userID, tenantID uuid.UUID, role models.UserRole, req models.RebuildVMRequest) (*models.VirtualMachine, error) {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, err
	}

	// Operators can ONLY rebuild explicitly assigned VMs
	if role == models.RoleOperator {
		hasAccess, err := s.CheckOperatorVMAccess(ctx, userID, vmID)
		if err != nil || !hasAccess {
			return nil, errors.New("access denied: this virtual machine is not assigned to your operator account")
		}
	}

	lockKey := fmt.Sprintf("vm:%s:power", vmID.String())
	locked, _ := s.redis.AcquireLock(ctx, lockKey, 20*time.Second)
	if !locked {
		return nil, errors.New("an operation is already in progress for this virtual machine")
	}
	defer s.redis.ReleaseLock(ctx, lockKey)

	cluster, err := s.getClusterSafely(ctx, vm.ClusterID)
	if err != nil {
		return nil, fmt.Errorf("cluster '%s' not found for VM: %w", vm.ClusterID, err)
	}

	var node models.Node
	if vm.NodeID != "" {
		_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 OR cluster_id = $2 LIMIT 1`, vm.NodeID, cluster.ID)
	}
	if node.ID == "" {
		node.ID = vm.NodeID
	}

	driver := s.driverFactory.GetDriverForCluster(cluster)
	if err := driver.RebuildVM(ctx, cluster, &node, vm.VMID, req); err != nil {
		return nil, fmt.Errorf("hypervisor OS rebuild failed: %w", err)
	}

	targetStatus := models.VMStatusStopped
	if req.StartAfter {
		targetStatus = models.VMStatusRunning
	}

	vm.Status = targetStatus
	vm.OSType = req.OSType
	vm.UpdatedAt = time.Now()

	_, err = s.db.ExecContext(ctx, `UPDATE virtual_machines SET status = $1, os_type = $2, updated_at = $3 WHERE id = $4`,
		vm.Status, vm.OSType, vm.UpdatedAt, vm.ID)
	if err != nil {
		return nil, err
	}

	s.LogActivity(ctx, vm.TenantID, &vm.ID, userID, "REBUILD_VM", "SUCCESS",
		fmt.Sprintf("OS Reinstalled with '%s' (ISO: %s, Boot: %v)", req.OSType, req.ISOImage, req.StartAfter))

	return vm, nil
}

func (s *VMService) GetVMTelemetry(ctx context.Context, vmID, userID, tenantID uuid.UUID, role models.UserRole) (*models.VMTelemetry, error) {
	vm, err := s.GetVMByID(ctx, vmID)
	if err != nil {
		return nil, err
	}

	if role == models.RoleOperator {
		if vm.TenantID != tenantID {
			return nil, errors.New("access denied: cannot access VM telemetry of another organization")
		}
		hasAccess, err := s.CheckOperatorVMAccess(ctx, userID, vmID)
		if err != nil || !hasAccess {
			return nil, errors.New("access denied: this virtual machine is not assigned to your account")
		}
	}

	cluster, err := s.getClusterSafely(ctx, vm.ClusterID)
	if err != nil {
		return nil, err
	}

	var node models.Node
	if vm.NodeID != "" {
		_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 OR cluster_id = $2 LIMIT 1`, vm.NodeID, cluster.ID)
	}

	driver := s.driverFactory.GetDriverForCluster(cluster)
	return driver.GetVMTelemetry(ctx, cluster, &node, vm.VMID, vm)
}

func (s *VMService) ListFleetTelemetry(ctx context.Context, tenantID, userID uuid.UUID, role models.UserRole) ([]models.VMTelemetry, error) {
	vms, err := s.ListVMs(ctx, tenantID, userID, role)
	if err != nil {
		return nil, err
	}

	telemetryList := make([]models.VMTelemetry, 0, len(vms))
	for _, vm := range vms {
		cluster, _ := s.getClusterSafely(ctx, vm.ClusterID)
		var node models.Node
		if vm.NodeID != "" {
			_ = s.db.GetContext(ctx, &node, `SELECT * FROM nodes WHERE id = $1 OR cluster_id = $2 LIMIT 1`, vm.NodeID, cluster.ID)
		}
		driver := s.driverFactory.GetDriverForCluster(cluster)
		tel, err := driver.GetVMTelemetry(ctx, cluster, &node, vm.VMID, &vm)
		if err == nil && tel != nil {
			telemetryList = append(telemetryList, *tel)
		}
	}

	return telemetryList, nil
}

func (s *VMService) GetAuditLogs(ctx context.Context, userID uuid.UUID, role models.UserRole, page, limit int, search, action, status string, exportAll bool) (*models.AuditLogsResponse, error) {
	if exportAll {
		limit = 2000
		page = 1
	} else {
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}
		if limit > 200 {
			limit = 200
		}
	}
	offset := (page - 1) * limit

	baseFrom := `FROM vm_activity_logs l
                 LEFT JOIN users u ON l.user_id = u.id
                 LEFT JOIN virtual_machines v ON l.vm_id = v.id`

	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if role != models.RoleAdmin {
		whereClauses = append(whereClauses, fmt.Sprintf("(l.user_id = $%d OR l.vm_id IN (SELECT vm_id FROM user_vm_assignments WHERE user_id = $%d))", argIdx, argIdx))
		args = append(args, userID)
		argIdx++
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(l.details ILIKE $%d OR COALESCE(v.name, '') ILIKE $%d OR COALESCE(u.username, '') ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if action != "" && action != "ALL" {
		whereClauses = append(whereClauses, fmt.Sprintf("l.action = $%d", argIdx))
		args = append(args, action)
		argIdx++
	}

	if status != "" && status != "ALL" {
		whereClauses = append(whereClauses, fmt.Sprintf("l.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) %s WHERE %s", baseFrom, whereSQL)
	if err := s.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, err
	}

	query := fmt.Sprintf(`SELECT l.id, l.tenant_id, l.vm_id, l.user_id, l.action, l.status, l.details, l.created_at,
                                 COALESCE(u.username, 'System') as username, COALESCE(v.name, 'N/A') as vm_name
                          %s
                          WHERE %s
                          ORDER BY l.created_at DESC
                          LIMIT $%d OFFSET $%d`, baseFrom, whereSQL, argIdx, argIdx+1)
	args = append(args, limit, offset)

	logs := []models.VMActivityLog{}
	if err := s.db.SelectContext(ctx, &logs, query, args...); err != nil {
		return nil, err
	}

	totalPages := (total + limit - 1) / limit
	if totalPages < 1 {
		totalPages = 1
	}

	return &models.AuditLogsResponse{
		Logs:       logs,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// CheckOperatorVMAccess checks whether an operator has been explicitly assigned to manage a specific VM
func (s *VMService) CheckOperatorVMAccess(ctx context.Context, userID, vmID uuid.UUID) (bool, error) {
	var count int
	err := s.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM user_vm_assignments WHERE user_id = $1 AND vm_id = $2`, userID, vmID)
	return count > 0, err
}
