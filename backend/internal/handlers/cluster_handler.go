package handlers

import (
	"net/http"

	"iaas-dashboard/internal/services"

	"github.com/gin-gonic/gin"
)

type ClusterHandler struct {
	clusterService *services.ClusterService
}

func NewClusterHandler(clusterService *services.ClusterService) *ClusterHandler {
	return &ClusterHandler{clusterService: clusterService}
}

func (h *ClusterHandler) GetDashboardSummary(c *gin.Context) {
	summary, err := h.clusterService.GetDashboardSummary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch dashboard summary: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *ClusterHandler) GetAllClusters(c *gin.Context) {
	clusters, err := h.clusterService.GetAllClustersWithNodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve clusters: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, clusters)
}

func (h *ClusterHandler) GetCluster(c *gin.Context) {
	clusterID := c.Param("id")
	cluster, err := h.clusterService.GetClusterByID(c.Request.Context(), clusterID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cluster not found: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, cluster)
}
