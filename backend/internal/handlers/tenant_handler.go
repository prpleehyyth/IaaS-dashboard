package handlers

import (
	"net/http"

	"iaas-dashboard/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type TenantHandler struct {
	db *sqlx.DB
}

func NewTenantHandler(db *sqlx.DB) *TenantHandler {
	return &TenantHandler{db: db}
}

func (h *TenantHandler) ListTenants(c *gin.Context) {
	var tenants []models.Tenant
	err := h.db.SelectContext(c.Request.Context(), &tenants, `SELECT * FROM tenants ORDER BY name ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list tenants: " + err.Error()})
		return
	}

	// Compute live quota utilization
	for i := range tenants {
		type usage struct {
			CPU  int `db:"cpu"`
			RAM  int `db:"ram"`
			Disk int `db:"disk"`
			VMs  int `db:"vms"`
		}
		var u usage
		_ = h.db.GetContext(c.Request.Context(), &u,
			`SELECT COUNT(*) as vms, COALESCE(SUM(cpu_cores), 0) as cpu, 
                    COALESCE(SUM(ram_mb), 0) as ram, COALESCE(SUM(disk_gb), 0) as disk 
             FROM virtual_machines WHERE tenant_id = $1`, tenants[i].ID)

		tenants[i].UsedCPU = u.CPU
		tenants[i].UsedRAMGB = u.RAM / 1024
		tenants[i].UsedStorageGB = u.Disk
		tenants[i].UsedVMs = u.VMs
	}

	c.JSON(http.StatusOK, tenants)
}

type UpdateQuotaRequest struct {
	MaxCPU       int `json:"max_cpu" binding:"required,min=1"`
	MaxRAMGB     int `json:"max_ram_gb" binding:"required,min=1"`
	MaxStorageGB int `json:"max_storage_gb" binding:"required,min=10"`
	MaxVMs       int `json:"max_vms" binding:"required,min=1"`
}

func (h *TenantHandler) UpdateQuota(c *gin.Context) {
	idStr := c.Param("id")
	tenantID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tenant UUID format"})
		return
	}

	var req UpdateQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid quota configuration: " + err.Error()})
		return
	}

	query := `UPDATE tenants SET max_cpu = $1, max_ram_gb = $2, max_storage_gb = $3, max_vms = $4, updated_at = NOW() WHERE id = $5`
	_, err = h.db.ExecContext(c.Request.Context(), query, req.MaxCPU, req.MaxRAMGB, req.MaxStorageGB, req.MaxVMs, tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tenant quotas: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tenant quotas updated successfully"})
}
