package drivers

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
)

type SimulatorDriver struct{}

func NewSimulatorDriver() *SimulatorDriver {
	return &SimulatorDriver{}
}

func (s *SimulatorDriver) RefreshNodeStats(ctx context.Context, cluster *models.Cluster, node *models.Node) (*models.Node, error) {
	// Add slight dynamic realistic variance to CPU and RAM usage
	deltaCPU := (rand.Float64() * 4.0) - 2.0 // +/- 2%
	newCPU := node.CPUUsagePct + deltaCPU
	if newCPU < 10.0 {
		newCPU = 12.5
	} else if newCPU > 92.0 {
		newCPU = 88.0
	}
	node.CPUUsagePct = float64(int(newCPU*10)) / 10.0

	deltaRAM := (rand.Float64() * 2.0) - 1.0 // +/- 1 GB
	newRAM := node.RAMUsageGB + deltaRAM
	if newRAM < 20.0 {
		newRAM = 25.0
	} else if newRAM > float64(node.RAMTotalGB)*0.95 {
		newRAM = float64(node.RAMTotalGB) * 0.90
	}
	node.RAMUsageGB = float64(int(newRAM*10)) / 10.0
	node.UptimeSeconds += 30

	return node, nil
}

func (s *SimulatorDriver) CreateVM(ctx context.Context, cluster *models.Cluster, node *models.Node, req models.CreateVMRequest) (int, string, string, error) {
	// Generate new VMID
	rand.Seed(time.Now().UnixNano())
	var vmid int
	var ip string
	var mac string

	if cluster.Type == models.HypervisorVMware {
		vmid = 1000 + rand.Intn(8999)
		ip = fmt.Sprintf("10.10.%d.%d", rand.Intn(3)+1, rand.Intn(200)+20)
		mac = fmt.Sprintf("00:50:56:%02x:%02x:%02x", rand.Intn(255), rand.Intn(255), rand.Intn(255))
	} else {
		vmid = 100 + rand.Intn(899)
		ip = fmt.Sprintf("10.20.1.%d", rand.Intn(200)+20)
		mac = fmt.Sprintf("BC:24:11:%02x:%02x:%02x", rand.Intn(255), rand.Intn(255), rand.Intn(255))
	}

	return vmid, ip, mac, nil
}

func (s *SimulatorDriver) UpdateVMSpecs(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.UpdateVMRequest) error {
	// Simulated successfully applied to hypervisor
	return nil
}

func (s *SimulatorDriver) DeleteVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	// Simulated hypervisor unregister and storage purge
	return nil
}

func (s *SimulatorDriver) StartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	// Simulate hypervisor power on delay
	time.Sleep(100 * time.Millisecond)
	return nil
}

func (s *SimulatorDriver) StopVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, force bool) error {
	// Simulate ACPI shutdown / guest shutdown
	time.Sleep(100 * time.Millisecond)
	return nil
}

func (s *SimulatorDriver) RestartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	time.Sleep(150 * time.Millisecond)
	return nil
}

func (s *SimulatorDriver) GetConsoleTicket(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vmName string) (*ConsoleConnectionInfo, error) {
	ticket := uuid.New().String()
	proto := "vnc"
	if cluster.Type == models.HypervisorVMware {
		proto = "webmks"
	}

	return &ConsoleConnectionInfo{
		Ticket:       ticket,
		Protocol:     proto,
		TargetHost:   node.IPAddress,
		TargetPort:   5900 + (vmid % 100),
		WebSocketURL: fmt.Sprintf("/api/v1/vms/%d/console/ws?ticket=%s", vmid, ticket),
	}, nil
}

func (s *SimulatorDriver) TestConnection(ctx context.Context, cluster *models.Cluster) (*models.TestClusterConnectionResponse, error) {
	return &models.TestClusterConnectionResponse{
		Success:   true,
		Message:   fmt.Sprintf("Simulator active: Connected to simulated %s cluster endpoint (%s)", cluster.Type, cluster.Endpoint),
		Version:   "Hypervisor Simulator v2.0",
		NodeCount: 3,
		VMCount:   0,
	}, nil
}

func (s *SimulatorDriver) DiscoverNodes(ctx context.Context, cluster *models.Cluster) ([]models.Node, error) {
	return []models.Node{}, nil
}

func (s *SimulatorDriver) DiscoverVMs(ctx context.Context, cluster *models.Cluster) ([]models.VirtualMachine, error) {
	return []models.VirtualMachine{}, nil
}

func (s *SimulatorDriver) ListISOs(ctx context.Context, cluster *models.Cluster, node *models.Node) ([]models.ISOImageInfo, error) {
	return []models.ISOImageInfo{
		{
			VolID:    "local:iso/ubuntu-22.04.4-live-server-amd64.iso",
			FileName: "ubuntu-22.04.4-live-server-amd64.iso",
			SizeGB:   1.97,
			Storage:  "local",
		},
		{
			VolID:    "local:iso/debian-12.5.0-amd64-netinst.iso",
			FileName: "debian-12.5.0-amd64-netinst.iso",
			SizeGB:   0.63,
			Storage:  "local",
		},
		{
			VolID:    "local:iso/alpine-standard-3.19.1-x86_64.iso",
			FileName: "alpine-standard-3.19.1-x86_64.iso",
			SizeGB:   0.21,
			Storage:  "local",
		},
	}, nil
}

