package handlers

import (
	"net/http"

	"iaas-dashboard/internal/models"
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

func (h *ClusterHandler) CreateCluster(c *gin.Context) {
	var req models.CreateClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cluster request: " + err.Error()})
		return
	}

	cluster, err := h.clusterService.CreateCluster(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cluster: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cluster)
}

func (h *ClusterHandler) DeleteCluster(c *gin.Context) {
	clusterID := c.Param("id")
	if err := h.clusterService.DeleteCluster(c.Request.Context(), clusterID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete cluster: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cluster deleted successfully"})
}

func (h *ClusterHandler) AddNode(c *gin.Context) {
	clusterID := c.Param("id")
	var req models.CreateNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid node request: " + err.Error()})
		return
	}

	node, err := h.clusterService.AddNodeToCluster(c.Request.Context(), clusterID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add node: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, node)
}

func (h *ClusterHandler) DeleteNode(c *gin.Context) {
	clusterID := c.Param("id")
	nodeID := c.Param("nodeId")
	if err := h.clusterService.DeleteNode(c.Request.Context(), clusterID, nodeID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove node: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Node removed successfully"})
}

func (h *ClusterHandler) TestConnection(c *gin.Context) {
	var req models.TestClusterConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid test connection payload: " + err.Error()})
		return
	}

	res, err := h.clusterService.TestClusterConnection(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to test cluster connection: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *ClusterHandler) SyncCluster(c *gin.Context) {
	clusterID := c.Param("id")
	cluster, err := h.clusterService.SyncCluster(c.Request.Context(), clusterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to synchronize cluster: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, cluster)
}

func (h *ClusterHandler) ResetVirgin(c *gin.Context) {
	if err := h.clusterService.ResetToVirgin(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset database: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database reset to virgin state successfully. All clusters, nodes, VMs and logs cleared."})
}

func (h *ClusterHandler) GetClusterISOs(c *gin.Context) {
	clusterID := c.Param("id")
	nodeID := c.Query("node")

	isos, err := h.clusterService.GetClusterISOs(c.Request.Context(), clusterID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ISO images: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, isos)
}

