package services

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"

	"iaas-dashboard/internal/config"
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

		`DO $$
		DECLARE
		    rec RECORD;
		    keeper_id UUID;
		BEGIN
		    FOR rec IN 
		        SELECT cluster_id, vmid
		        FROM virtual_machines
		        WHERE vmid > 0
		        GROUP BY cluster_id, vmid
		        HAVING COUNT(*) > 1
		    LOOP
		        SELECT id INTO keeper_id
		        FROM virtual_machines v
		        WHERE v.cluster_id = rec.cluster_id AND v.vmid = rec.vmid
		        ORDER BY 
		            (SELECT COUNT(*) FROM user_vm_assignments a WHERE a.vm_id = v.id) DESC,
		            (v.status = 'RUNNING') DESC,
		            v.updated_at DESC,
		            v.created_at DESC
		        LIMIT 1;

		        IF EXISTS (SELECT 1 FROM virtual_machines WHERE cluster_id = rec.cluster_id AND vmid = rec.vmid AND status = 'RUNNING') THEN
		            UPDATE virtual_machines SET status = 'RUNNING' WHERE id = keeper_id;
		        END IF;

		        UPDATE user_vm_assignments
		        SET vm_id = keeper_id
		        WHERE vm_id IN (
		            SELECT id FROM virtual_machines 
		            WHERE cluster_id = rec.cluster_id AND vmid = rec.vmid AND id != keeper_id
		        )
		        AND NOT EXISTS (
		            SELECT 1 FROM user_vm_assignments a2 
		            WHERE a2.user_id = user_vm_assignments.user_id AND a2.vm_id = keeper_id
		        );

		        DELETE FROM user_vm_assignments
		        WHERE vm_id IN (
		            SELECT id FROM virtual_machines 
		            WHERE cluster_id = rec.cluster_id AND vmid = rec.vmid AND id != keeper_id
		        );

		        UPDATE resource_metering_samples
		        SET vm_id = keeper_id
		        WHERE vm_id IN (
		            SELECT id FROM virtual_machines 
		            WHERE cluster_id = rec.cluster_id AND vmid = rec.vmid AND id != keeper_id
		        );

		        UPDATE vm_activity_logs
		        SET vm_id = keeper_id
		        WHERE vm_id IN (
		            SELECT id FROM virtual_machines 
		            WHERE cluster_id = rec.cluster_id AND vmid = rec.vmid AND id != keeper_id
		        );

		        DELETE FROM virtual_machines
		        WHERE cluster_id = rec.cluster_id AND vmid = rec.vmid AND id != keeper_id;
		    END LOOP;
		END $$;`,

		`CREATE UNIQUE INDEX IF NOT EXISTS uq_vm_cluster_vmid ON virtual_machines (cluster_id, vmid) WHERE vmid > 0;`,
	}
	for _, m := range migrations {
		_, _ = s.db.ExecContext(ctx, m)
	}

	// Encrypt any existing plaintext cluster auth_secret records at rest
	var existing []struct {
		ID         string `db:"id"`
		AuthSecret string `db:"auth_secret"`
	}
	if err := s.db.SelectContext(ctx, &existing, `SELECT id, COALESCE(auth_secret, '') as auth_secret FROM clusters WHERE auth_secret != ''`); err == nil {
		for _, c := range existing {
			if !strings.HasPrefix(c.AuthSecret, config.EncryptedSecretPrefix) {
				enc := config.EncryptSecret(c.AuthSecret, "")
				_, _ = s.db.ExecContext(ctx, `UPDATE clusters SET auth_secret = $1 WHERE id = $2`, enc, c.ID)
			}
		}
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
	if err := validateHypervisorEndpoint(req.Endpoint); err != nil {
		return nil, err
	}
	if req.ID == "" {
		req.ID = strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
	}
	encryptedSecret := config.EncryptSecret(req.AuthSecret, "")
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
		req.AuthUser, encryptedSecret, req.InsecureSSL,
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

func validateHypervisorEndpoint(rawEndpoint string) error {
	trimmed := strings.TrimSpace(rawEndpoint)
	endpointLower := strings.ToLower(trimmed)
	if !strings.HasPrefix(endpointLower, "http://") && !strings.HasPrefix(endpointLower, "https://") {
		return errors.New("invalid endpoint protocol: must begin with http:// or https://")
	}

	parsedURL, err := url.Parse(trimmed)
	if err != nil || parsedURL.Hostname() == "" {
		return errors.New("invalid endpoint URL format")
	}

	host := strings.ToLower(parsedURL.Hostname())
	port := parsedURL.Port()

	// Block cloud metadata services and internal infrastructure services
	blockedHosts := map[string]bool{
		"169.254.169.254":          true,
		"metadata.google.internal": true,
		"metadata":                 true,
		"postgres":                 true,
		"iaas-postgres":            true,
		"redis":                    true,
		"iaas-redis":               true,
		"backend":                  true,
		"iaas-backend":             true,
		"frontend":                 true,
		"iaas-frontend":            true,
	}
	if blockedHosts[host] {
		return errors.New("security violation: connection to internal or cloud metadata services is forbidden")
	}

	// Block sensitive internal ports (PostgreSQL, Redis, API, SSH)
	blockedPorts := map[string]bool{
		"5432": true,
		"6379": true,
		"8080": true,
		"22":   true,
	}
	if blockedPorts[port] {
		return fmt.Errorf("security violation: connection to restricted internal service port %s is forbidden", port)
	}

	// Check IP literal or DNS resolution against link-local & loopback ranges (allow port 8989 for local lab simulator)
	ips, err := net.LookupIP(host)
	if err == nil {
		for _, ip := range ips {
			if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || strings.HasPrefix(ip.String(), "169.254.") {
				return errors.New("security violation: connection to link-local / cloud metadata IP range is forbidden")
			}
			if ip.IsLoopback() && port != "8989" {
				return errors.New("security violation: connection to loopback interface is forbidden")
			}
		}
	} else if ip := net.ParseIP(host); ip != nil {
		if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return errors.New("security violation: connection to link-local IP range is forbidden")
		}
		if ip.IsLoopback() && port != "8989" {
			return errors.New("security violation: connection to loopback interface is forbidden")
		}
	}

	return nil
}

func (s *ClusterService) TestClusterConnection(ctx context.Context, req models.TestClusterConnectionRequest) (*models.TestClusterConnectionResponse, error) {
	if err := validateHypervisorEndpoint(req.Endpoint); err != nil {
		return nil, err
	}

	authUser := req.AuthUser
	authSecret := req.AuthSecret

	// If secret was omitted (e.g. testing an already registered cluster from UI), load stored secret from DB
	if authSecret == "" {
		var stored struct {
			AuthUser   string `db:"auth_user"`
			AuthSecret string `db:"auth_secret"`
		}
		if req.ClusterID != "" {
			_ = s.db.GetContext(ctx, &stored, `SELECT COALESCE(auth_user, '') as auth_user, COALESCE(auth_secret, '') as auth_secret FROM clusters WHERE id = $1 LIMIT 1`, req.ClusterID)
		}
		if stored.AuthSecret == "" && req.Endpoint != "" {
			_ = s.db.GetContext(ctx, &stored, `SELECT COALESCE(auth_user, '') as auth_user, COALESCE(auth_secret, '') as auth_secret FROM clusters WHERE endpoint = $1 LIMIT 1`, req.Endpoint)
		}
		if stored.AuthSecret != "" {
			authSecret = config.DecryptSecret(stored.AuthSecret, "")
			if authUser == "" {
				authUser = stored.AuthUser
			}
		}
	}

	driver := s.driverFactory.CreateDriver(req.Type, req.Endpoint, authUser, authSecret, req.InsecureSSL, req.Datacenter)
	testCluster := &models.Cluster{
		ID:          "test-cluster",
		Type:        req.Type,
		Endpoint:    req.Endpoint,
		Datacenter:  req.Datacenter,
		AuthUser:    authUser,
		AuthSecret:  authSecret,
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
			if vm.VMID > 0 {
				vmQuery := `
					INSERT INTO virtual_machines (id, tenant_id, cluster_id, node_id, hypervisor_type, name, status, cpu_cores, ram_mb, disk_gb, vmid, os_type, ip_address, mac_address, console_port, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '', '', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
					ON CONFLICT (cluster_id, vmid) WHERE vmid > 0 DO UPDATE SET
						node_id = EXCLUDED.node_id,
						name = EXCLUDED.name,
						status = EXCLUDED.status,
						cpu_cores = EXCLUDED.cpu_cores,
						ram_mb = EXCLUDED.ram_mb,
						disk_gb = EXCLUDED.disk_gb,
						os_type = CASE WHEN virtual_machines.os_type = '' OR virtual_machines.os_type IS NULL THEN EXCLUDED.os_type ELSE virtual_machines.os_type END,
						updated_at = CURRENT_TIMESTAMP
				`
				_, _ = s.db.ExecContext(ctx, vmQuery,
					vm.ID, tenantID, cluster.ID, vm.NodeID, cluster.Type, vm.Name, vm.Status, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.VMID, vm.OSType,
				)
			} else {
				// Fallback when VMID is 0: check existing by name in cluster
				var existingID uuid.UUID
				err := s.db.GetContext(ctx, &existingID, `SELECT id FROM virtual_machines WHERE cluster_id = $1 AND name = $2 LIMIT 1`, cluster.ID, vm.Name)
				if err == nil && existingID != uuid.Nil {
					_, _ = s.db.ExecContext(ctx, `
						UPDATE virtual_machines SET
							node_id = $1,
							status = $2,
							cpu_cores = $3,
							ram_mb = $4,
							disk_gb = $5,
							updated_at = CURRENT_TIMESTAMP
						WHERE id = $6
					`, vm.NodeID, vm.Status, vm.CPUCores, vm.RAMMB, vm.DiskGB, existingID)
				} else {
					_, _ = s.db.ExecContext(ctx, `
						INSERT INTO virtual_machines (id, tenant_id, cluster_id, node_id, hypervisor_type, name, status, cpu_cores, ram_mb, disk_gb, vmid, os_type, ip_address, mac_address, console_port, created_at, updated_at)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '', '', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
						ON CONFLICT (id) DO NOTHING
					`, vm.ID, tenantID, cluster.ID, vm.NodeID, cluster.Type, vm.Name, vm.Status, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.VMID, vm.OSType)
				}
			}
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
	cfg := config.Load()
	if strings.EqualFold(cfg.HypervisorMode, "PRODUCTION") {
		return errors.New("security violation: ResetToVirgin is disabled in PRODUCTION mode")
	}

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

func (s *ClusterService) GetDashboardSummary(ctx context.Context, userID uuid.UUID, role models.UserRole) (*models.DashboardSummaryResponse, error) {
	type vmCounts struct {
		Total   int `db:"total"`
		Running int `db:"running"`
		Stopped int `db:"stopped"`
		CPU     int `db:"cpu"`
		RAM     int `db:"ram"`
		Disk    int `db:"disk"`
	}

	var vmc vmCounts
	var clusters []models.Cluster
	var totalNodes, totalCPU, totalRAM int
	var totalStorage float64
	recentLogs := []models.VMActivityLog{}

	if role == models.RoleAdmin {
		allClusters, err := s.GetAllClustersWithNodes(ctx)
		if err != nil {
			return nil, err
		}
		clusters = allClusters

		query := `SELECT 
	                COUNT(*) as total,
	                COUNT(CASE WHEN status = 'RUNNING' THEN 1 END) as running,
	                COUNT(CASE WHEN status = 'STOPPED' THEN 1 END) as stopped,
	                COALESCE(SUM(cpu_cores), 0) as cpu,
	                COALESCE(SUM(ram_mb), 0) as ram,
	                COALESCE(SUM(disk_gb), 0) as disk
	              FROM virtual_machines`
		_ = s.db.GetContext(ctx, &vmc, query)

		for _, c := range clusters {
			totalNodes += len(c.Nodes)
			totalCPU += c.TotalCPUCores
			totalRAM += c.TotalRAMGB
			totalStorage += c.TotalStorageTB
		}

		logQuery := `SELECT l.id, l.tenant_id, l.vm_id, l.user_id, l.action, l.status, l.details, l.created_at,
	                        COALESCE(u.username, 'System') as username, COALESCE(v.name, 'N/A') as vm_name
	                 FROM vm_activity_logs l
	                 LEFT JOIN users u ON l.user_id = u.id
	                 LEFT JOIN virtual_machines v ON l.vm_id = v.id
	                 ORDER BY l.created_at DESC LIMIT 10`
		_ = s.db.SelectContext(ctx, &recentLogs, logQuery)
	} else {
		// Operator role: hide host clusters and physical nodes, only calculate metrics for assigned VMs
		clusters = []models.Cluster{}
		query := `SELECT 
	                COUNT(*) as total,
	                COUNT(CASE WHEN v.status = 'RUNNING' THEN 1 END) as running,
	                COUNT(CASE WHEN v.status = 'STOPPED' THEN 1 END) as stopped,
	                COALESCE(SUM(v.cpu_cores), 0) as cpu,
	                COALESCE(SUM(v.ram_mb), 0) as ram,
	                COALESCE(SUM(v.disk_gb), 0) as disk
	              FROM virtual_machines v
	              INNER JOIN user_vm_assignments a ON v.id = a.vm_id
	              WHERE a.user_id = $1`
		_ = s.db.GetContext(ctx, &vmc, query, userID)

		logQuery := `SELECT l.id, l.tenant_id, l.vm_id, l.user_id, l.action, l.status, l.details, l.created_at,
	                        COALESCE(u.username, 'System') as username, COALESCE(v.name, 'N/A') as vm_name
	                 FROM vm_activity_logs l
	                 LEFT JOIN users u ON l.user_id = u.id
	                 LEFT JOIN virtual_machines v ON l.vm_id = v.id
	                 WHERE l.user_id = $1 OR l.vm_id IN (SELECT vm_id FROM user_vm_assignments WHERE user_id = $1)
	                 ORDER BY l.created_at DESC LIMIT 10`
		_ = s.db.SelectContext(ctx, &recentLogs, logQuery, userID)
	}

	totalVMs := vmc.Total
	runningVMs := vmc.Running
	stoppedVMs := vmc.Stopped
	allocCPU := vmc.CPU
	allocRAM := vmc.RAM / 1024
	allocDisk := vmc.Disk

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
