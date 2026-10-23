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

func (h *MeteringHandler) GetBillingReport(c *gin.Context) {
	role := middleware.GetUserRole(c)
	userID := middleware.GetUserID(c)

	report, err := h.meteringService.GetUserBillingReport(c.Request.Context(), userID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate billing report: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

func (h *MeteringHandler) GetBillingRates(c *gin.Context) {
	rates, err := h.meteringService.GetBillingRates(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get billing rates: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, rates)
}

func (h *MeteringHandler) UpdateBillingRates(c *gin.Context) {
	var req models.UpdateBillingRatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid billing rates payload: " + err.Error()})
		return
	}

	rates, err := h.meteringService.UpdateBillingRates(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update billing rates: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, rates)
}
