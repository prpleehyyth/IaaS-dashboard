package services

import (
	"context"
	"math"
	"time"

	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type MeteringService struct {
	db *sqlx.DB
}

func NewMeteringService(db *sqlx.DB) *MeteringService {
	svc := &MeteringService{db: db}
	svc.EnsureSchema(context.Background())
	return svc
}

func (s *MeteringService) EnsureSchema(ctx context.Context) {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS billing_rates (
			id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
			currency VARCHAR(10) DEFAULT 'IDR',
			cpu_rate_hourly NUMERIC(12, 2) DEFAULT 250.00,
			ram_rate_hourly NUMERIC(12, 2) DEFAULT 100.00,
			storage_rate_hourly NUMERIC(12, 2) DEFAULT 1.50,
			network_rate_hourly NUMERIC(12, 2) DEFAULT 50.00,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);`,
		`INSERT INTO billing_rates (id, currency, cpu_rate_hourly, ram_rate_hourly, storage_rate_hourly, network_rate_hourly)
		 VALUES ('default', 'IDR', 250.00, 100.00, 1.50, 50.00)
		 ON CONFLICT (id) DO NOTHING;`,
	}
	for _, m := range migrations {
		_, _ = s.db.ExecContext(ctx, m)
	}
}

func (s *MeteringService) GetBillingRates(ctx context.Context) (*models.BillingRates, error) {
	s.EnsureSchema(ctx)
	var rates models.BillingRates
	err := s.db.GetContext(ctx, &rates, `SELECT id, currency, cpu_rate_hourly, ram_rate_hourly, storage_rate_hourly, network_rate_hourly, updated_at FROM billing_rates WHERE id = 'default' LIMIT 1`)
	if err != nil {
		return &models.BillingRates{
			ID:                "default",
			Currency:          "IDR",
			CPURateHourly:     250.00,
			RAMRateHourly:     100.00,
			StorageRateHourly: 1.50,
			NetworkRateHourly: 50.00,
			UpdatedAt:         time.Now(),
		}, nil
	}
	return &rates, nil
}

func (s *MeteringService) UpdateBillingRates(ctx context.Context, req models.UpdateBillingRatesRequest) (*models.BillingRates, error) {
	s.EnsureSchema(ctx)
	currency := req.Currency
	if currency == "" {
		currency = "IDR"
	}
	query := `
		UPDATE billing_rates
		SET currency = $1,
		    cpu_rate_hourly = $2,
		    ram_rate_hourly = $3,
		    storage_rate_hourly = $4,
		    network_rate_hourly = $5,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = 'default'
		RETURNING id, currency, cpu_rate_hourly, ram_rate_hourly, storage_rate_hourly, network_rate_hourly, updated_at
	`
	var rates models.BillingRates
	err := s.db.GetContext(ctx, &rates, query, currency, req.CPURateHourly, req.RAMRateHourly, req.StorageRateHourly, req.NetworkRateHourly)
	if err != nil {
		return nil, err
	}
	return &rates, nil
}

func (s *MeteringService) GetUserBillingReport(ctx context.Context, userID uuid.UUID, role string) (*models.UserBillingReport, error) {
	rates, err := s.GetBillingRates(ctx)
	if err != nil {
		return nil, err
	}

	var username string
	_ = s.db.GetContext(ctx, &username, `SELECT username FROM users WHERE id = $1`, userID)
	if username == "" {
		username = "user"
	}

	type vmRow struct {
		ID               uuid.UUID `db:"id"`
		Name             string    `db:"name"`
		Status           string    `db:"status"`
		CPUCores         int       `db:"cpu_cores"`
		RAMMB            int       `db:"ram_mb"`
		DiskGB           int       `db:"disk_gb"`
		IPAddress        string    `db:"ip_address"`
		ClusterName      string    `db:"cluster_name"`
		NodeName         string    `db:"node_name"`
		AssignedUserName string    `db:"assigned_user_name"`
	}

	var rows []vmRow
	if role == models.RoleAdmin {
		query := `SELECT v.id, v.name, v.status, v.cpu_cores, v.ram_mb, v.disk_gb,
		                 COALESCE(v.ip_address, '') as ip_address,
		                 COALESCE(c.name, 'Default Cluster') as cluster_name,
		                 COALESCE(n.name, 'Default Node') as node_name,
		                 COALESCE(u.username, 'All Users / Fleet') as assigned_user_name
		          FROM virtual_machines v
		          LEFT JOIN clusters c ON v.cluster_id = c.id
		          LEFT JOIN nodes n ON v.node_id = n.id
		          LEFT JOIN user_vm_assignments a ON v.id = a.vm_id
		          LEFT JOIN users u ON a.user_id = u.id
		          ORDER BY v.name ASC`
		err = s.db.SelectContext(ctx, &rows, query)
	} else {
		query := `SELECT v.id, v.name, v.status, v.cpu_cores, v.ram_mb, v.disk_gb,
		                 COALESCE(v.ip_address, '') as ip_address,
		                 COALESCE(c.name, 'Default Cluster') as cluster_name,
		                 COALESCE(n.name, 'Default Node') as node_name,
		                 COALESCE(u.username, $2) as assigned_user_name
		          FROM virtual_machines v
		          INNER JOIN user_vm_assignments a ON v.id = a.vm_id
		          LEFT JOIN clusters c ON v.cluster_id = c.id
		          LEFT JOIN nodes n ON v.node_id = n.id
		          LEFT JOIN users u ON a.user_id = u.id
		          WHERE a.user_id = $1
		          ORDER BY v.name ASC`
		err = s.db.SelectContext(ctx, &rows, query, userID, username)
	}
	if err != nil {
		return nil, err
	}

	var items []models.VMBillingItem
	var totalCores int
	var totalRAMMB int
	var totalDisk int
	var totalHourly float64

	for _, r := range rows {
		cpuCost := float64(r.CPUCores) * rates.CPURateHourly
		ramCost := (float64(r.RAMMB) / 1024.0) * rates.RAMRateHourly
		storageCost := float64(r.DiskGB) * rates.StorageRateHourly
		networkCost := rates.NetworkRateHourly

		vmHourly := cpuCost + ramCost + storageCost + networkCost
		vmMonthly := vmHourly * 720.0

		// Round to 2 decimals
		cpuCost = math.Round(cpuCost*100) / 100
		ramCost = math.Round(ramCost*100) / 100
		storageCost = math.Round(storageCost*100) / 100
		networkCost = math.Round(networkCost*100) / 100
		vmHourly = math.Round(vmHourly*100) / 100
		vmMonthly = math.Round(vmMonthly*100) / 100

		totalCores += r.CPUCores
		totalRAMMB += r.RAMMB
		totalDisk += r.DiskGB
		totalHourly += vmHourly

		items = append(items, models.VMBillingItem{
			VMID:              r.ID,
			VMName:            r.Name,
			Status:            r.Status,
			NodeName:          r.NodeName,
			ClusterName:       r.ClusterName,
			CPUCores:          r.CPUCores,
			RAMMB:             r.RAMMB,
			DiskGB:            r.DiskGB,
			IPAddress:         r.IPAddress,
			CPUCostHourly:     cpuCost,
			RAMCostHourly:     ramCost,
			StorageCostHourly: storageCost,
			NetworkCostHourly: networkCost,
			TotalHourly:       vmHourly,
			TotalMonthly:      vmMonthly,
			AssignedUserName:  r.AssignedUserName,
		})
	}

	if items == nil {
		items = []models.VMBillingItem{}
	}

	totalHourly = math.Round(totalHourly*100) / 100
	totalMonthly := math.Round(totalHourly*720.0*100) / 100
	totalRAMGB := math.Round((float64(totalRAMMB)/1024.0)*10) / 10

	return &models.UserBillingReport{
		UserID:        userID,
		Username:      username,
		Role:          role,
		TotalVMs:      len(items),
		TotalCPUCores: totalCores,
		TotalRAMGB:    totalRAMGB,
		TotalDiskGB:   totalDisk,
		TotalHourly:   totalHourly,
		TotalMonthly:  totalMonthly,
		VMs:           items,
		Rates:         *rates,
	}, nil
}

func (s *MeteringService) GetTenantMeteringSummary(ctx context.Context, tenantID uuid.UUID) (*models.MeteringTenantSummary, error) {
	var tenant models.Tenant
	err := s.db.GetContext(ctx, &tenant, `SELECT * FROM tenants WHERE id = $1`, tenantID)
	if err != nil {
		return nil, err
	}

	type aggStats struct {
		ActiveVMs  int     `db:"active_vms"`
		VCPUHours  float64 `db:"vcpu_hours"`
		RAMGBHours float64 `db:"ram_gb_hours"`
		DiskGBDays float64 `db:"disk_gb_days"`
	}

	var stats aggStats
	query := `SELECT 
                COUNT(DISTINCT vm_id) as active_vms,
                COALESCE(SUM(cpu_cores), 0)::float8 * 1.0 as vcpu_hours,
                COALESCE(SUM(ram_mb), 0)::float8 / 1024.0 as ram_gb_hours,
                COALESCE(SUM(disk_gb), 0)::float8 / 24.0 as disk_gb_days
              FROM resource_metering_samples
              WHERE tenant_id = $1`

	_ = s.db.GetContext(ctx, &stats, query, tenantID)

	rates, _ := s.GetBillingRates(ctx)
	estCost := (stats.VCPUHours * rates.CPURateHourly) + (stats.RAMGBHours * rates.RAMRateHourly) + (stats.DiskGBDays * (rates.StorageRateHourly * 24.0))

	now := time.Now()
	return &models.MeteringTenantSummary{
		TenantID:        tenant.ID,
		TenantName:      tenant.Name,
		ActiveVMCount:   stats.ActiveVMs,
		TotalVCPUHours:  float64(int(stats.VCPUHours*100)) / 100.0,
		TotalRAMGBHours: float64(int(stats.RAMGBHours*100)) / 100.0,
		TotalDiskGBDays: float64(int(stats.DiskGBDays*100)) / 100.0,
		EstimatedCost:   float64(int(estCost*100)) / 100.0,
		PeriodStart:     now.Add(-24 * time.Hour),
		PeriodEnd:       now,
	}, nil
}

func (s *MeteringService) GetAllTenantsMetering(ctx context.Context) ([]models.MeteringTenantSummary, error) {
	var tenants []models.Tenant
	err := s.db.SelectContext(ctx, &tenants, `SELECT * FROM tenants ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}

	var results []models.MeteringTenantSummary
	for _, t := range tenants {
		summary, err := s.GetTenantMeteringSummary(ctx, t.ID)
		if err == nil && summary != nil {
			results = append(results, *summary)
		}
	}

	return results, nil
}
