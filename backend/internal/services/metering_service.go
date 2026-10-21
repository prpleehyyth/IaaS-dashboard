package services

import (
	"context"
	"time"

	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type MeteringService struct {
	db *sqlx.DB
}

func NewMeteringService(db *sqlx.DB) *MeteringService {
	return &MeteringService{db: db}
}

func (s *MeteringService) GetTenantMeteringSummary(ctx context.Context, tenantID uuid.UUID) (*models.MeteringTenantSummary, error) {
	var tenant models.Tenant
	err := s.db.GetContext(ctx, &tenant, `SELECT * FROM tenants WHERE id = $1`, tenantID)
	if err != nil {
		return nil, err
	}

	// Fetch aggregated usage metrics
	type aggStats struct {
		ActiveVMs   int     `db:"active_vms"`
		VCPUHours   float64 `db:"vcpu_hours"`
		RAMGBHours  float64 `db:"ram_gb_hours"`
		DiskGBDays  float64 `db:"disk_gb_days"`
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

	// Baseline pre-wired unit rates (flexible for custom billing plan document):
	// vCPU hour: $0.015, RAM GB hour: $0.005, Disk GB day: $0.003
	estCost := (stats.VCPUHours * 0.015) + (stats.RAMGBHours * 0.005) + (stats.DiskGBDays * 0.003)

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
