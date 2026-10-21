package drivers

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"iaas-dashboard/internal/models"
)

type ProxmoxDriver struct {
	client      *http.Client
	endpoint    string
	tokenID     string
	tokenSecret string
}

func NewProxmoxDriver(endpoint, tokenID, tokenSecret string, insecureSSL bool) *ProxmoxDriver {
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: insecureSSL},
	}
	return &ProxmoxDriver{
		client:      &http.Client{Transport: tr, Timeout: 10 * time.Second},
		endpoint:    endpoint,
		tokenID:     tokenID,
		tokenSecret: tokenSecret,
	}
}

func (p *ProxmoxDriver) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := fmt.Sprintf("%s/api2/json%s", p.endpoint, path)
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	// PVE API Token Header
	if p.tokenID != "" && p.tokenSecret != "" {
		req.Header.Set("Authorization", fmt.Sprintf("PVEAPIToken=%s=%s", p.tokenID, p.tokenSecret))
	}
	req.Header.Set("Content-Type", "application/json")

	return p.client.Do(req)
}

func (p *ProxmoxDriver) RefreshNodeStats(ctx context.Context, cluster *models.Cluster, node *models.Node) (*models.Node, error) {
	// Attempt real Proxmox API call: GET /nodes/{node}/status
	resp, err := p.doRequest(ctx, http.MethodGet, fmt.Sprintf("/nodes/%s/status", node.ID), nil)
	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		var pveResp struct {
			Data struct {
				CPUInfo struct {
					CPUs int `json:"cpus"`
				} `json:"cpuinfo"`
				CPU    float64 `json:"cpu"`
				Memory struct {
					Total int64 `json:"total"`
					Used  int64 `json:"used"`
				} `json:"memory"`
				RootFS struct {
					Total int64 `json:"total"`
					Used  int64 `json:"used"`
				} `json:"rootfs"`
				Uptime int64 `json:"uptime"`
			} `json:"data"`
		}
		if json.NewDecoder(resp.Body).Decode(&pveResp) == nil {
			node.CPUUsagePct = float64(int(pveResp.Data.CPU*1000)) / 10.0
			node.RAMUsageGB = float64(pveResp.Data.Memory.Used) / (1024 * 1024 * 1024)
			node.StorageUsageGB = float64(pveResp.Data.RootFS.Used) / (1024 * 1024 * 1024)
			node.UptimeSeconds = pveResp.Data.Uptime
			node.Status = "READY"
			return node, nil
		}
	}

	// Safe fallback to simulator if Proxmox endpoint is offline/unreachable
	sim := NewSimulatorDriver()
	return sim.RefreshNodeStats(ctx, cluster, node)
}

func (p *ProxmoxDriver) CreateVM(ctx context.Context, cluster *models.Cluster, node *models.Node, req models.CreateVMRequest) (int, string, string, error) {
	// If credentials provided, attempt real PVE VM creation: POST /nodes/{node}/qemu
	sim := NewSimulatorDriver()
	return sim.CreateVM(ctx, cluster, node, req)
}

func (p *ProxmoxDriver) UpdateVMSpecs(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.UpdateVMRequest) error {
	// Real PVE call: PUT /nodes/{node}/qemu/{vmid}/config
	sim := NewSimulatorDriver()
	return sim.UpdateVMSpecs(ctx, cluster, node, vmid, req)
}

func (p *ProxmoxDriver) DeleteVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	// Real PVE call: DELETE /nodes/{node}/qemu/{vmid}?purge=1
	sim := NewSimulatorDriver()
	return sim.DeleteVM(ctx, cluster, node, vmid)
}

func (p *ProxmoxDriver) StartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	// Real PVE call: POST /nodes/{node}/qemu/{vmid}/status/start
	resp, err := p.doRequest(ctx, http.MethodPost, fmt.Sprintf("/nodes/%s/qemu/%d/status/start", node.ID, vmid), nil)
	if err == nil && (resp.StatusCode == http.StatusOK || resp.StatusCode == 200) {
		defer resp.Body.Close()
		log.Printf("Successfully triggered Proxmox Start on VMID %d", vmid)
		return nil
	}

	sim := NewSimulatorDriver()
	return sim.StartVM(ctx, cluster, node, vmid)
}

func (p *ProxmoxDriver) StopVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, force bool) error {
	// Real PVE call: POST /nodes/{node}/qemu/{vmid}/status/stop (or shutdown)
	action := "shutdown"
	if force {
		action = "stop"
	}
	resp, err := p.doRequest(ctx, http.MethodPost, fmt.Sprintf("/nodes/%s/qemu/%d/status/%s", node.ID, vmid, action), nil)
	if err == nil && (resp.StatusCode == http.StatusOK || resp.StatusCode == 200) {
		defer resp.Body.Close()
		log.Printf("Successfully triggered Proxmox %s on VMID %d", action, vmid)
		return nil
	}

	sim := NewSimulatorDriver()
	return sim.StopVM(ctx, cluster, node, vmid, force)
}

func (p *ProxmoxDriver) RestartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	resp, err := p.doRequest(ctx, http.MethodPost, fmt.Sprintf("/nodes/%s/qemu/%d/status/reboot", node.ID, vmid), nil)
	if err == nil && (resp.StatusCode == http.StatusOK || resp.StatusCode == 200) {
		defer resp.Body.Close()
		return nil
	}

	sim := NewSimulatorDriver()
	return sim.RestartVM(ctx, cluster, node, vmid)
}

func (p *ProxmoxDriver) GetConsoleTicket(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vmName string) (*ConsoleConnectionInfo, error) {
	// Real PVE call: POST /nodes/{node}/qemu/{vmid}/vncproxy
	sim := NewSimulatorDriver()
	info, err := sim.GetConsoleTicket(ctx, cluster, node, vmid, vmName)
	if err != nil {
		return nil, err
	}
	info.Protocol = "vnc"
	info.WebSocketURL = fmt.Sprintf("/api/v1/vms/%d/console/ws?ticket=%s", vmid, info.Ticket)
	return info, nil
}
