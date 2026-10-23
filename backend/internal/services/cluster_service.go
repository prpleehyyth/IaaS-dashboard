package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"iaas-dashboard/internal/database"
	"iaas-dashboard/internal/drivers"
	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type ClusterService struct {
	db            *sqlx.DB
	redis         *database.RedisClient
	driverFactory *drivers.DriverFactory
}

func NewClusterService(db *sqlx.DB, redis *database.RedisClient, driverFactory *drivers.DriverFactory) *ClusterService {
	svc := &ClusterService{
		db:            db,
		redis:         redis,
		driverFactory: driverFactory,
	}
	svc.EnsureSchema(context.Background())
	return svc
}

func (s *ClusterService) EnsureSchema(ctx context.Context) {
	migrations := []string{
		`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS auth_user VARCHAR(150) DEFAULT '';`,
		`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS auth_secret TEXT DEFAULT '';`,
		`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS insecure_ssl BOOLEAN DEFAULT true;`,
		`ALTER TABLE clusters ADD COLUMN IF NOT EXISTS version VARCHAR(50) DEFAULT '';`,
		`ALTER TABLE clusters ALTER COLUMN version SET DEFAULT '';`,
		`ALTER TABLE clusters ALTER COLUMN description SET DEFAULT '';`,
		`ALTER TABLE clusters ALTER COLUMN auth_user SET DEFAULT '';`,
		`ALTER TABLE clusters ALTER COLUMN auth_secret SET DEFAULT '';`,
		`UPDATE clusters SET version = '' WHERE version IS NULL;`,
		`UPDATE clusters SET description = '' WHERE description IS NULL;`,
		`UPDATE clusters SET auth_user = '' WHERE auth_user IS NULL;`,
		`UPDATE clusters SET auth_secret = '' WHERE auth_secret IS NULL;`,

		`ALTER TABLE virtual_machines ALTER COLUMN ip_address SET DEFAULT '';`,
		`ALTER TABLE virtual_machines ALTER COLUMN mac_address SET DEFAULT '';`,
		`ALTER TABLE virtual_machines ALTER COLUMN console_port SET DEFAULT 0;`,
		`ALTER TABLE virtual_machines ALTER COLUMN vmid SET DEFAULT 0;`,
		`UPDATE virtual_machines SET ip_address = '' WHERE ip_address IS NULL;`,
		`UPDATE virtual_machines SET mac_address = '' WHERE mac_address IS NULL;`,
		`UPDATE virtual_machines SET console_port = 0 WHERE console_port IS NULL;`,
		`UPDATE virtual_machines SET vmid = 0 WHERE vmid IS NULL;`,
	}
	for _, m := range migrations {
		_, _ = s.db.ExecContext(ctx, m)
	}
}

func (s *ClusterService) GetAllClustersWithNodes(ctx context.Context) ([]models.Cluster, error) {
	s.EnsureSchema(ctx)
	clusters := []models.Cluster{}
	query := `
		SELECT id, name, type, datacenter, endpoint, 
		       COALESCE(auth_user, '') as auth_user, 
		       COALESCE(auth_secret, '') as auth_secret, 
		       insecure_ssl, 
		       COALESCE(version, '') as version, 
		       status, total_cpu_cores, total_ram_gb, total_storage_tb, 
		       COALESCE(description, '') as description, 
		       created_at 
		FROM clusters ORDER BY type DESC, name ASC
	`
	err := s.db.SelectContext(ctx, &clusters, query)
	if err != nil {
		return clusters, err
	}

	for i := range clusters {
		nodes := []models.Node{}
		err := s.db.SelectContext(ctx, &nodes, `SELECT * FROM nodes WHERE cluster_id = $1 ORDER BY name ASC`, clusters[i].ID)
		if err == nil {
			driver := s.driverFactory.GetDriverForCluster(&clusters[i])
			for j := range nodes {
				updatedNode, _ := driver.RefreshNodeStats(ctx, &clusters[i], &nodes[j])
				if updatedNode != nil {
					nodes[j] = *updatedNode
				}
			}
			clusters[i].Nodes = nodes
		} else {
			clusters[i].Nodes = []models.Node{}
		}
	}

	return clusters, nil
}

func (s *ClusterService) GetClusterByID(ctx context.Context, clusterID string) (*models.Cluster, error) {
	s.EnsureSchema(ctx)
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
	err := s.db.GetContext(ctx, &cluster, query, clusterID)
	if err != nil {
		return nil, err
	}

	nodes := []models.Node{}
	err = s.db.SelectContext(ctx, &nodes, `SELECT * FROM nodes WHERE cluster_id = $1 ORDER BY name ASC`, clusterID)
	if err == nil {
		cluster.Nodes = nodes
	} else {
		cluster.Nodes = []models.Node{}
	}

	return &cluster, nil
}

func (s *ClusterService) CreateCluster(ctx context.Context, req models.CreateClusterRequest) (*models.Cluster, error) {
	s.EnsureSchema(ctx)
	if req.ID == "" {
		req.ID = strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
	}
	query := `
		INSERT INTO clusters (id, name, type, datacenter, endpoint, auth_user, auth_secret, insecure_ssl, status, total_cpu_cores, total_ram_gb, total_storage_tb, description, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ONLINE', $9, $10, $11, $12, $13)
		RETURNING id, name, type, datacenter, endpoint, 
		          COALESCE(auth_user, '') as auth_user, 
		          COALESCE(auth_secret, '') as auth_secret, 
		          insecure_ssl, 
		          COALESCE(version, '') as version, 
		          status, total_cpu_cores, total_ram_gb, total_storage_tb, 
		          COALESCE(description, '') as description, 
		          created_at
	`
	var cluster models.Cluster
	err := s.db.GetContext(ctx, &cluster, query,
		req.ID, req.Name, req.Type, req.Datacenter, req.Endpoint,
		req.AuthUser, req.AuthSecret, req.InsecureSSL,
		req.TotalCPUCores, req.TotalRAMGB, req.TotalStorageTB, req.Description, req.Version,
	)
	if err != nil {
		return nil, err
	}
	cluster.Nodes = []models.Node{}

	// If AutoDiscover is checked, query the hypervisor immediately!
	if req.AutoDiscover {
		synced, err := s.SyncCluster(ctx, cluster.ID)
		if err == nil && synced != nil {
			cluster = *synced
		} else {
			clusterPtr, _ := s.GetClusterByID(ctx, cluster.ID)
			if clusterPtr != nil {
				cluster = *clusterPtr
			}
		}
	}

	return &cluster, nil
}

func (s *ClusterService) DeleteCluster(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM clusters WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("cluster not found")
	}
	return nil
}

func (s *ClusterService) AddNodeToCluster(ctx context.Context, clusterID string, req models.CreateNodeRequest) (*models.Node, error) {
	if req.ID == "" {
		req.ID = strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
	}
	query := `
		INSERT INTO nodes (id, cluster_id, name, ip_address, status, cpu_model, cpu_cores, cpu_usage_pct, ram_total_gb, ram_usage_gb, storage_total_gb, storage_usage_gb, uptime_seconds)
		VALUES ($1, $2, $3, $4, 'READY', $5, $6, 0.0, $7, 0.0, $8, 0.0, 0)
		RETURNING *
	`
	var node models.Node
	err := s.db.GetContext(ctx, &node, query,
		req.ID, clusterID, req.Name, req.IPAddress, req.CPUModel, req.CPUCores, req.RAMTotalGB, req.StorageTotalGB,
	)
	if err != nil {
		return nil, err
	}

	// Update cluster capacity summaries
	_, _ = s.db.ExecContext(ctx, `
		UPDATE clusters SET 
			total_cpu_cores = (SELECT COALESCE(SUM(cpu_cores), 0) FROM nodes WHERE cluster_id = $1),
			total_ram_gb = (SELECT COALESCE(SUM(ram_total_gb), 0) FROM nodes WHERE cluster_id = $1),
			total_storage_tb = (SELECT COALESCE(SUM(storage_total_gb), 0)::numeric / 1000 FROM nodes WHERE cluster_id = $1)
		WHERE id = $1
	`, clusterID)

	return &node, nil
}

func (s *ClusterService) DeleteNode(ctx context.Context, clusterID, nodeID string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM nodes WHERE id = $1 AND cluster_id = $2`, nodeID, clusterID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("node not found")
	}

	// Update cluster capacity summaries
	_, _ = s.db.ExecContext(ctx, `
		UPDATE clusters SET 
			total_cpu_cores = (SELECT COALESCE(SUM(cpu_cores), 0) FROM nodes WHERE cluster_id = $1),
			total_ram_gb = (SELECT COALESCE(SUM(ram_total_gb), 0) FROM nodes WHERE cluster_id = $1),
			total_storage_tb = (SELECT COALESCE(SUM(storage_total_gb), 0)::numeric / 1000 FROM nodes WHERE cluster_id = $1)
		WHERE id = $1
	`, clusterID)

	return nil
}

func (s *ClusterService) TestClusterConnection(ctx context.Context, req models.TestClusterConnectionRequest) (*models.TestClusterConnectionResponse, error) {
	driver := s.driverFactory.CreateDriver(req.Type, req.Endpoint, req.AuthUser, req.AuthSecret, req.InsecureSSL, req.Datacenter)
	testCluster := &models.Cluster{
		ID:          "test-cluster",
		Type:        req.Type,
		Endpoint:    req.Endpoint,
		Datacenter:  req.Datacenter,
		AuthUser:    req.AuthUser,
		AuthSecret:  req.AuthSecret,
		InsecureSSL: req.InsecureSSL,
	}
	return driver.TestConnection(ctx, testCluster)
}

func (s *ClusterService) SyncCluster(ctx context.Context, clusterID string) (*models.Cluster, error) {
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
		return nil, fmt.Errorf("cluster not found: %w", err)
	}

	driver := s.driverFactory.GetDriverForCluster(&cluster)

	// Fetch / update version if possible
	testRes, err := driver.TestConnection(ctx, &cluster)
	if err == nil && testRes != nil && testRes.Version != "" {
		cluster.Version = testRes.Version
		_, _ = s.db.ExecContext(ctx, `UPDATE clusters SET version = $1 WHERE id = $2`, testRes.Version, cluster.ID)
	}

	// 1. Discover Nodes
	discoveredNodes, err := driver.DiscoverNodes(ctx, &cluster)
	if err == nil && len(discoveredNodes) > 0 {
		for _, n := range discoveredNodes {
			nodeQuery := `
				INSERT INTO nodes (id, cluster_id, name, ip_address, status, cpu_model, cpu_cores, cpu_usage_pct, ram_total_gb, ram_usage_gb, storage_total_gb, storage_usage_gb, uptime_seconds)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
				ON CONFLICT (id) DO UPDATE SET
					cluster_id = EXCLUDED.cluster_id,
					name = EXCLUDED.name,
					ip_address = EXCLUDED.ip_address,
					status = EXCLUDED.status,
					cpu_cores = EXCLUDED.cpu_cores,
					ram_total_gb = EXCLUDED.ram_total_gb,
					storage_total_gb = EXCLUDED.storage_total_gb,
					uptime_seconds = EXCLUDED.uptime_seconds
			`
			_, _ = s.db.ExecContext(ctx, nodeQuery,
				n.ID, cluster.ID, n.Name, n.IPAddress, n.Status, n.CPUModel, n.CPUCores, n.CPUUsagePct, n.RAMTotalGB, n.RAMUsageGB, n.StorageTotalGB, n.StorageUsageGB, n.UptimeSeconds,
			)
		}
	}

	// 2. Discover VMs
	discoveredVMs, err := driver.DiscoverVMs(ctx, &cluster)
	if err == nil && len(discoveredVMs) > 0 {
		var tenantID uuid.UUID
		_ = s.db.GetContext(ctx, &tenantID, `SELECT id FROM tenants LIMIT 1`)

		for _, vm := range discoveredVMs {
			vmQuery := `
				INSERT INTO virtual_machines (id, tenant_id, cluster_id, node_id, hypervisor_type, name, status, cpu_cores, ram_mb, disk_gb, vmid, os_type, ip_address, mac_address, console_port)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '', '', 0)
				ON CONFLICT (id) DO NOTHING
			`
			_, _ = s.db.ExecContext(ctx, vmQuery,
				vm.ID, tenantID, cluster.ID, vm.NodeID, cluster.Type, vm.Name, vm.Status, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.VMID, vm.OSType,
			)
		}
	}

	// 3. Update Cluster Totals
	_, _ = s.db.ExecContext(ctx, `
		UPDATE clusters SET 
			status = 'ONLINE',
			total_cpu_cores = (SELECT COALESCE(SUM(cpu_cores), 0) FROM nodes WHERE cluster_id = $1),
			total_ram_gb = (SELECT COALESCE(SUM(ram_total_gb), 0) FROM nodes WHERE cluster_id = $1),
			total_storage_tb = (SELECT COALESCE(SUM(storage_total_gb), 0)::numeric / 1000 FROM nodes WHERE cluster_id = $1)
		WHERE id = $1
	`, cluster.ID)

	return s.GetClusterByID(ctx, cluster.ID)
}

func (s *ClusterService) ResetToVirgin(ctx context.Context) error {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	queries := []string{
		`TRUNCATE TABLE resource_metering_samples, user_vm_assignments, vm_activity_logs, virtual_machines, nodes, clusters CASCADE;`,
		`DELETE FROM users WHERE username != 'admin';`,
		`DELETE FROM tenants WHERE id != 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';`,
		`UPDATE tenants SET name = 'Default Organization', slug = 'default-org', description = 'Primary Development Tenant';`,
	}

	for _, q := range queries {
		if _, err := tx.ExecContext(ctx, q); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *ClusterService) GetDashboardSummary(ctx context.Context) (*models.DashboardSummaryResponse, error) {
	clusters, err := s.GetAllClustersWithNodes(ctx)
	if err != nil {
		return nil, err
	}

	var totalVMs, runningVMs, stoppedVMs int
	var allocCPU, allocRAM, allocDisk int

	type vmCounts struct {
		Total   int `db:"total"`
		Running int `db:"running"`
		Stopped int `db:"stopped"`
		CPU     int `db:"cpu"`
		RAM     int `db:"ram"`
		Disk    int `db:"disk"`
	}

	var vmc vmCounts
	query := `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'RUNNING' THEN 1 END) as running,
                COUNT(CASE WHEN status = 'STOPPED' THEN 1 END) as stopped,
                COALESCE(SUM(cpu_cores), 0) as cpu,
                COALESCE(SUM(ram_mb), 0) as ram,
                COALESCE(SUM(disk_gb), 0) as disk
              FROM virtual_machines`

	_ = s.db.GetContext(ctx, &vmc, query)

	totalVMs = vmc.Total
	runningVMs = vmc.Running
	stoppedVMs = vmc.Stopped
	allocCPU = vmc.CPU
	allocRAM = vmc.RAM / 1024
	allocDisk = vmc.Disk

	// Compute cluster totals
	var totalNodes, totalCPU, totalRAM int
	var totalStorage float64

	for _, c := range clusters {
		totalNodes += len(c.Nodes)
		totalCPU += c.TotalCPUCores
		totalRAM += c.TotalRAMGB
		totalStorage += c.TotalStorageTB
	}

	// Fetch recent 10 activity logs
	recentLogs := []models.VMActivityLog{}
	logQuery := `SELECT l.id, l.tenant_id, l.vm_id, l.user_id, l.action, l.status, l.details, l.created_at,
                        u.username, COALESCE(v.name, 'N/A') as vm_name
                 FROM vm_activity_logs l
                 LEFT JOIN users u ON l.user_id = u.id
                 LEFT JOIN virtual_machines v ON l.vm_id = v.id
                 ORDER BY l.created_at DESC LIMIT 10`
	_ = s.db.SelectContext(ctx, &recentLogs, logQuery)

	return &models.DashboardSummaryResponse{
		TotalClusters:   len(clusters),
		TotalNodes:      totalNodes,
		TotalVMs:        totalVMs,
		RunningVMs:      runningVMs,
		StoppedVMs:      stoppedVMs,
		TotalCPUCores:   totalCPU,
		AllocatedCPU:    allocCPU,
		TotalRAMGB:      totalRAM,
		AllocatedRAMGB:  allocRAM,
		TotalStorageTB:  totalStorage,
		AllocatedDiskGB: allocDisk,
		Clusters:        clusters,
		RecentLogs:      recentLogs,
	}, nil
}

func (s *ClusterService) GetClusterISOs(ctx context.Context, clusterID string, nodeID string) ([]models.ISOImageInfo, error) {
	cluster, err := s.GetClusterByID(ctx, clusterID)
	if err != nil {
		return nil, fmt.Errorf("cluster not found: %w", err)
	}

	var targetNode *models.Node
	if nodeID != "" {
		for i := range cluster.Nodes {
			if cluster.Nodes[i].ID == nodeID || cluster.Nodes[i].Name == nodeID {
				targetNode = &cluster.Nodes[i]
				break
			}
		}
	}
	if targetNode == nil && len(cluster.Nodes) > 0 {
		targetNode = &cluster.Nodes[0]
	}

	driver := s.driverFactory.GetDriverForCluster(cluster)
	return driver.ListISOs(ctx, cluster, targetNode)
}
