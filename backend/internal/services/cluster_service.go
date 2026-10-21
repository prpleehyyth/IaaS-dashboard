package services

import (
	"context"
	"iaas-dashboard/internal/database"
	"iaas-dashboard/internal/drivers"
	"iaas-dashboard/internal/models"

	"github.com/jmoiron/sqlx"
)

type ClusterService struct {
	db            *sqlx.DB
	redis         *database.RedisClient
	driverFactory *drivers.DriverFactory
}

func NewClusterService(db *sqlx.DB, redis *database.RedisClient, driverFactory *drivers.DriverFactory) *ClusterService {
	return &ClusterService{
		db:            db,
		redis:         redis,
		driverFactory: driverFactory,
	}
}

func (s *ClusterService) GetAllClustersWithNodes(ctx context.Context) ([]models.Cluster, error) {
	var clusters []models.Cluster
	err := s.db.SelectContext(ctx, &clusters, `SELECT * FROM clusters ORDER BY type DESC, name ASC`)
	if err != nil {
		return nil, err
	}

	for i := range clusters {
		var nodes []models.Node
		err := s.db.SelectContext(ctx, &nodes, `SELECT * FROM nodes WHERE cluster_id = $1 ORDER BY name ASC`, clusters[i].ID)
		if err == nil {
			// Update node stats dynamically via driver
			driver := s.driverFactory.GetDriver(clusters[i].Type)
			for j := range nodes {
				updatedNode, _ := driver.RefreshNodeStats(ctx, &clusters[i], &nodes[j])
				if updatedNode != nil {
					nodes[j] = *updatedNode
				}
			}
			clusters[i].Nodes = nodes
		}
	}

	return clusters, nil
}

func (s *ClusterService) GetClusterByID(ctx context.Context, clusterID string) (*models.Cluster, error) {
	var cluster models.Cluster
	err := s.db.GetContext(ctx, &cluster, `SELECT * FROM clusters WHERE id = $1`, clusterID)
	if err != nil {
		return nil, err
	}

	var nodes []models.Node
	err = s.db.SelectContext(ctx, &nodes, `SELECT * FROM nodes WHERE cluster_id = $1 ORDER BY name ASC`, clusterID)
	if err == nil {
		cluster.Nodes = nodes
	}

	return &cluster, nil
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
	var recentLogs []models.VMActivityLog
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
