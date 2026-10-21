package handlers

import (
	"net/http"

	"iaas-dashboard/internal/middleware"
	"iaas-dashboard/internal/models"
	"iaas-dashboard/internal/services"

	"github.com/gin-gonic/gin"
)

type MeteringHandler struct {
	meteringService *services.MeteringService
}

func NewMeteringHandler(meteringService *services.MeteringService) *MeteringHandler {
	return &MeteringHandler{meteringService: meteringService}
}

func (h *MeteringHandler) GetMeteringSummary(c *gin.Context) {
	role := middleware.GetUserRole(c)
	tenantID := middleware.GetTenantID(c)

	if role == models.RoleAdmin {
		summaries, err := h.meteringService.GetAllTenantsMetering(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate telemetry: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, summaries)
	} else {
		summary, err := h.meteringService.GetTenantMeteringSummary(c.Request.Context(), tenantID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to calculate tenant telemetry: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, []models.MeteringTenantSummary{*summary})
	}
}
