package handlers

import (
	"net/http"
	"strconv"

	"iaas-dashboard/internal/middleware"
	"iaas-dashboard/internal/models"
	"iaas-dashboard/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type VMHandler struct {
	vmService *services.VMService
}

func NewVMHandler(vmService *services.VMService) *VMHandler {
	return &VMHandler{vmService: vmService}
}

func (h *VMHandler) ListVMs(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	userID := middleware.GetUserID(c)
	role := middleware.GetUserRole(c)

	vms, err := h.vmService.ListVMs(c.Request.Context(), tenantID, userID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list virtual machines: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, vms)
}

func (h *VMHandler) GetVM(c *gin.Context) {
	idStr := c.Param("id")
	vmID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM UUID format"})
		return
	}

	vm, err := h.vmService.GetVMByID(c.Request.Context(), vmID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Operators can only view their own assigned VMs within their tenant
	role := middleware.GetUserRole(c)
	tenantID := middleware.GetTenantID(c)
	if role == models.RoleOperator {
		if vm.TenantID != tenantID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: cannot access VM of another tenant"})
			return
		}
		userID := middleware.GetUserID(c)
		hasAccess, err := h.vmService.CheckOperatorVMAccess(c.Request.Context(), userID, vmID)
		if err != nil || !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: this virtual machine is not assigned to your operator account"})
			return
		}
	}

	c.JSON(http.StatusOK, vm)
}

func (h *VMHandler) CreateVM(c *gin.Context) {
	var req models.CreateVMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	tenantID := middleware.GetTenantID(c)
	userID := middleware.GetUserID(c)

	// Admin can optionally create VM for a specific tenant if provided via query
	targetTenantStr := c.Query("tenant_id")
	if targetTenantStr != "" {
		if parsed, err := uuid.Parse(targetTenantStr); err == nil {
			tenantID = parsed
		}
	}

	vm, err := h.vmService.CreateVM(c.Request.Context(), tenantID, userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, vm)
}

func (h *VMHandler) UpdateVM(c *gin.Context) {
	idStr := c.Param("id")
	vmID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM UUID format"})
		return
	}

	var req models.UpdateVMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	vm, err := h.vmService.UpdateVMSpecs(c.Request.Context(), vmID, userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, vm)
}

func (h *VMHandler) DeleteVM(c *gin.Context) {
	idStr := c.Param("id")
	vmID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM UUID format"})
		return
	}

	userID := middleware.GetUserID(c)
	err = h.vmService.DeleteVM(c.Request.Context(), vmID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Virtual machine successfully deleted"})
}

func (h *VMHandler) ExecutePowerAction(c *gin.Context) {
	idStr := c.Param("id")
	vmID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM UUID format"})
		return
	}

	var req models.VMActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action ('start', 'stop', 'restart') is required"})
		return
	}

	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)
	role := middleware.GetUserRole(c)

	vm, err := h.vmService.ExecutePowerAction(c.Request.Context(), vmID, userID, tenantID, role, req.Action, req.Force)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, vm)
}

func (h *VMHandler) RebuildVM(c *gin.Context) {
	idStr := c.Param("id")
	vmID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM UUID format"})
		return
	}

	var req models.RebuildVMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rebuild request: " + err.Error()})
		return
	}

	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)
	role := middleware.GetUserRole(c)

	vm, err := h.vmService.RebuildVM(c.Request.Context(), vmID, userID, tenantID, role, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, vm)
}

func (h *VMHandler) GetVMTelemetry(c *gin.Context) {
	idStr := c.Param("id")
	vmID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM UUID format"})
		return
	}

	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)
	role := middleware.GetUserRole(c)

	tel, err := h.vmService.GetVMTelemetry(c.Request.Context(), vmID, userID, tenantID, role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tel)
}

func (h *VMHandler) GetFleetTelemetry(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)
	role := middleware.GetUserRole(c)

	telemetryList, err := h.vmService.ListFleetTelemetry(c.Request.Context(), tenantID, userID, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, telemetryList)
}

func (h *VMHandler) GetAuditLogs(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role := middleware.GetUserRole(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	action := c.Query("action")
	status := c.Query("status")
	exportAll := c.Query("export") == "true" || c.Query("limit") == "0"

	resp, err := h.vmService.GetAuditLogs(c.Request.Context(), userID, role, page, limit, search, action, status, exportAll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}
