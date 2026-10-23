package drivers

import (
	"context"
	"iaas-dashboard/internal/models"
)

type ConsoleConnectionInfo struct {
	Ticket       string `json:"ticket"`
	Protocol     string `json:"protocol"` // "vnc" or "webmks"
	TargetHost   string `json:"target_host"`
	TargetPort   int    `json:"target_port"`
	WebSocketURL string `json:"websocket_url"`
	NoVNCURL     string `json:"novnc_url,omitempty"`
}

type HypervisorDriver interface {
	// Node Telemetry
	RefreshNodeStats(ctx context.Context, cluster *models.Cluster, node *models.Node) (*models.Node, error)

	// VM Lifecycle
	CreateVM(ctx context.Context, cluster *models.Cluster, node *models.Node, req models.CreateVMRequest) (int, string, string, error) // returns vmid, ip, mac, error
	UpdateVMSpecs(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.UpdateVMRequest) error
	DeleteVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error
	RebuildVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.RebuildVMRequest) error

	// VM Power Actions
	StartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error
	StopVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, force bool) error
	RestartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error

	// VM Telemetry & Real-Time Monitoring
	GetVMTelemetry(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vm *models.VirtualMachine) (*models.VMTelemetry, error)

	// Remote Console
	GetConsoleTicket(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vmName string) (*ConsoleConnectionInfo, error)

	// Connectivity & Auto-Discovery
	TestConnection(ctx context.Context, cluster *models.Cluster) (*models.TestClusterConnectionResponse, error)
	DiscoverNodes(ctx context.Context, cluster *models.Cluster) ([]models.Node, error)
	DiscoverVMs(ctx context.Context, cluster *models.Cluster) ([]models.VirtualMachine, error)
	ListISOs(ctx context.Context, cluster *models.Cluster, node *models.Node) ([]models.ISOImageInfo, error)
}

