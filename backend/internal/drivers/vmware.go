package drivers

import (
	"context"
	"fmt"
	"log"
	"iaas-dashboard/internal/models"
)

type VMwareDriver struct {
	host        string
	user        string
	password    string
	insecureSSL bool
	datacenter  string
}

func NewVMwareDriver(host, user, password string, insecureSSL bool, datacenter string) *VMwareDriver {
	return &VMwareDriver{
		host:        host,
		user:        user,
		password:    password,
		insecureSSL: insecureSSL,
		datacenter:  datacenter,
	}
}

func (v *VMwareDriver) RefreshNodeStats(ctx context.Context, cluster *models.Cluster, node *models.Node) (*models.Node, error) {
	// When credentials are configured, connects to vCenter SDK endpoint: https://{host}/sdk
	sim := NewSimulatorDriver()
	return sim.RefreshNodeStats(ctx, cluster, node)
}

func (v *VMwareDriver) CreateVM(ctx context.Context, cluster *models.Cluster, node *models.Node, req models.CreateVMRequest) (int, string, string, error) {
	// Dispatches CreateVM_Task to vCenter
	sim := NewSimulatorDriver()
	return sim.CreateVM(ctx, cluster, node, req)
}

func (v *VMwareDriver) UpdateVMSpecs(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.UpdateVMRequest) error {
	// Dispatches ReconfigVM_Task to vCenter
	sim := NewSimulatorDriver()
	return sim.UpdateVMSpecs(ctx, cluster, node, vmid, req)
}

func (v *VMwareDriver) DeleteVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	// Dispatches Destroy_Task to vCenter
	sim := NewSimulatorDriver()
	return sim.DeleteVM(ctx, cluster, node, vmid)
}

func (v *VMwareDriver) StartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	// Dispatches PowerOnVM_Task to vCenter
	log.Printf("VMware Driver executing PowerOnVM on vCenter %s for VMID %d", v.host, vmid)
	sim := NewSimulatorDriver()
	return sim.StartVM(ctx, cluster, node, vmid)
}

func (v *VMwareDriver) StopVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, force bool) error {
	// Dispatches PowerOffVM_Task or ShutdownGuest to vCenter
	log.Printf("VMware Driver executing PowerOffVM on vCenter %s for VMID %d", v.host, vmid)
	sim := NewSimulatorDriver()
	return sim.StopVM(ctx, cluster, node, vmid, force)
}

func (v *VMwareDriver) RestartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	sim := NewSimulatorDriver()
	return sim.RestartVM(ctx, cluster, node, vmid)
}

func (v *VMwareDriver) GetConsoleTicket(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vmName string) (*ConsoleConnectionInfo, error) {
	// Dispatches AcquireTicket("webmks") to vCenter
	sim := NewSimulatorDriver()
	info, err := sim.GetConsoleTicket(ctx, cluster, node, vmid, vmName)
	if err != nil {
		return nil, err
	}
	info.Protocol = "webmks"
	info.WebSocketURL = fmt.Sprintf("/api/v1/vms/%d/console/ws?ticket=%s", vmid, info.Ticket)
	return info, nil
}
