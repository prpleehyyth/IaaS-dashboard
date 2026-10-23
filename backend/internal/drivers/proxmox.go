package drivers

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
)

type ProxmoxDriver struct {
	client      *http.Client
	endpoint    string
	tokenID     string
	tokenSecret string
}

func NewProxmoxDriver(endpoint, tokenID, tokenSecret string, insecureSSL bool) *ProxmoxDriver {
	endpoint = strings.TrimSpace(endpoint)
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		endpoint = "https://" + endpoint
	}
	endpoint = strings.TrimRight(endpoint, "/")

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: insecureSSL},
	}
	return &ProxmoxDriver{
		client:      &http.Client{Transport: tr, Timeout: 8 * time.Second},
		endpoint:    endpoint,
		tokenID:     strings.TrimSpace(tokenID),
		tokenSecret: strings.TrimSpace(tokenSecret),
	}
}

func (p *ProxmoxDriver) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := fmt.Sprintf("%s/api2/json%s", p.endpoint, path)
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	// Proxmox API Token header: Authorization: PVEAPIToken=USER@REALM!TOKENID=SECRET
	if p.tokenID != "" && p.tokenSecret != "" {
		req.Header.Set("Authorization", fmt.Sprintf("PVEAPIToken=%s=%s", p.tokenID, p.tokenSecret))
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return p.client.Do(req)
}

func (p *ProxmoxDriver) TestConnection(ctx context.Context, cluster *models.Cluster) (*models.TestClusterConnectionResponse, error) {
	if p.endpoint == "" {
		return &models.TestClusterConnectionResponse{
			Success: false,
			Message: "Proxmox endpoint URL cannot be empty",
		}, nil
	}

	// 1. Query Proxmox Version
	resp, err := p.doRequest(ctx, http.MethodGet, "/version", nil)
	if err != nil {
		return &models.TestClusterConnectionResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to reach Proxmox at %s: %v", p.endpoint, err),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return &models.TestClusterConnectionResponse{
			Success: false,
			Message: fmt.Sprintf("Authentication failed (HTTP %d): Invalid Token ID or Secret. Ensure PVE API Token has PVEVMAdmin / PVESysAdmin permissions.", resp.StatusCode),
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return &models.TestClusterConnectionResponse{
			Success: false,
			Message: fmt.Sprintf("Proxmox returned HTTP %d on /version check", resp.StatusCode),
		}, nil
	}

	var versionResp struct {
		Data struct {
			Version string `json:"version"`
			Release string `json:"release"`
		} `json:"data"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&versionResp)
	versionStr := fmt.Sprintf("Proxmox VE %s", versionResp.Data.Release)
	if versionResp.Data.Release == "" && versionResp.Data.Version != "" {
		versionStr = fmt.Sprintf("Proxmox VE %s", versionResp.Data.Version)
	}

	// 2. Discover nodes & workloads
	nodes, _ := p.DiscoverNodes(ctx, cluster)
	vms, _ := p.DiscoverVMs(ctx, cluster)

	return &models.TestClusterConnectionResponse{
		Success:         true,
		Message:         fmt.Sprintf("Successfully connected to %s (%d nodes, %d VMs discovered)", versionStr, len(nodes), len(vms)),
		Version:         versionStr,
		NodeCount:       len(nodes),
		VMCount:         len(vms),
		DiscoveredNodes: nodes,
	}, nil
}

func (p *ProxmoxDriver) DiscoverNodes(ctx context.Context, cluster *models.Cluster) ([]models.Node, error) {
	resp, err := p.doRequest(ctx, http.MethodGet, "/nodes", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d on /nodes", resp.StatusCode)
	}

	var pveNodes struct {
		Data []struct {
			Node    string  `json:"node"`
			Status  string  `json:"status"`
			CPU     float64 `json:"cpu"`
			MaxCPU  int     `json:"maxcpu"`
			Mem     int64   `json:"mem"`
			MaxMem  int64   `json:"maxmem"`
			Disk    int64   `json:"disk"`
			MaxDisk int64   `json:"maxdisk"`
			Uptime  int64   `json:"uptime"`
			IP      string  `json:"ip"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&pveNodes); err != nil {
		return nil, err
	}

	nodes := make([]models.Node, 0, len(pveNodes.Data))
	for _, n := range pveNodes.Data {
		ip := n.IP
		if ip == "" {
			u, err := url.Parse(p.endpoint)
			if err == nil {
				ip = u.Hostname()
			} else {
				ip = "127.0.0.1"
			}
		}

		status := "OFFLINE"
		if n.Status == "online" {
			status = "READY"
		}

		ramGB := int(n.MaxMem / (1024 * 1024 * 1024))
		if ramGB <= 0 {
			ramGB = 16
		}
		storageGB := int(n.MaxDisk / (1024 * 1024 * 1024))
		if storageGB <= 0 {
			storageGB = 100
		}
		cpuCores := n.MaxCPU
		if cpuCores <= 0 {
			cpuCores = 4
		}

		nodes = append(nodes, models.Node{
			ID:             n.Node,
			ClusterID:      cluster.ID,
			Name:           n.Node,
			IPAddress:      ip,
			Status:         status,
			CPUModel:       "AMD EPYC / Intel Xeon (Proxmox KVM)",
			CPUCores:       cpuCores,
			CPUUsagePct:    math.Round(n.CPU*1000) / 10,
			RAMTotalGB:     ramGB,
			RAMUsageGB:     math.Round(float64(n.Mem)/(1024*1024*1024)*10) / 10,
			StorageTotalGB: storageGB,
			StorageUsageGB: math.Round(float64(n.Disk)/(1024*1024*1024)*10) / 10,
			UptimeSeconds:  n.Uptime,
		})
	}

	return nodes, nil
}

func (p *ProxmoxDriver) DiscoverVMs(ctx context.Context, cluster *models.Cluster) ([]models.VirtualMachine, error) {
	resp, err := p.doRequest(ctx, http.MethodGet, "/cluster/resources?type=vm", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d on /cluster/resources", resp.StatusCode)
	}

	var pveVMs struct {
		Data []struct {
			VMID    int    `json:"vmid"`
			Name    string `json:"name"`
			Node    string `json:"node"`
			Status  string `json:"status"`
			MaxCPU  int    `json:"maxcpu"`
			MaxMem  int64  `json:"maxmem"`
			MaxDisk int64  `json:"maxdisk"`
			Type    string `json:"type"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&pveVMs); err != nil {
		return nil, err
	}

	vms := make([]models.VirtualMachine, 0, len(pveVMs.Data))
	for _, item := range pveVMs.Data {
		status := models.VMStatusStopped
		if item.Status == "running" {
			status = models.VMStatusRunning
		}

		cpuCores := item.MaxCPU
		if cpuCores <= 0 {
			cpuCores = 2
		}
		ramMB := int(item.MaxMem / (1024 * 1024))
		if ramMB <= 0 {
			ramMB = 2048
		}
		diskGB := int(item.MaxDisk / (1024 * 1024 * 1024))
		if diskGB <= 0 {
			diskGB = 32
		}

		vms = append(vms, models.VirtualMachine{
			ID:             uuid.New(),
			ClusterID:      cluster.ID,
			NodeID:         item.Node,
			HypervisorType: models.HypervisorProxmox,
			Name:           item.Name,
			Status:         status,
			CPUCores:       cpuCores,
			RAMMB:          ramMB,
			DiskGB:         diskGB,
			OSType:         "Proxmox KVM / QEMU",
			VMID:           item.VMID,
		})
	}

	return vms, nil
}

func (p *ProxmoxDriver) RefreshNodeStats(ctx context.Context, cluster *models.Cluster, node *models.Node) (*models.Node, error) {
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

	node.Status = "OFFLINE"
	return node, nil
}

func (p *ProxmoxDriver) CreateVM(ctx context.Context, cluster *models.Cluster, node *models.Node, req models.CreateVMRequest) (int, string, string, error) {
	sim := NewSimulatorDriver()
	return sim.CreateVM(ctx, cluster, node, req)
}

func (p *ProxmoxDriver) UpdateVMSpecs(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.UpdateVMRequest) error {
	sim := NewSimulatorDriver()
	return sim.UpdateVMSpecs(ctx, cluster, node, vmid, req)
}

func (p *ProxmoxDriver) DeleteVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	nodeName := ""
	if node != nil && node.ID != "" {
		nodeName = node.ID
	}
	if nodeName == "" {
		nodeName = "pve"
	}

	// Try QEMU delete
	resp, err := p.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/nodes/%s/qemu/%d", nodeName, vmid), nil)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil
		}
	}

	// Try LXC delete
	respLXC, errLXC := p.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/nodes/%s/lxc/%d", nodeName, vmid), nil)
	if errLXC == nil {
		defer respLXC.Body.Close()
		if respLXC.StatusCode >= 200 && respLXC.StatusCode < 300 {
			return nil
		}
	}

	return nil
}

func (p *ProxmoxDriver) executeVMAction(ctx context.Context, nodeName string, vmid int, action string) error {
	if nodeName == "" {
		// Auto-detect node name from Proxmox if not provided
		resp, err := p.doRequest(ctx, http.MethodGet, "/nodes", nil)
		if err == nil {
			defer resp.Body.Close()
			var pveNodes struct {
				Data []struct {
					Node string `json:"node"`
				} `json:"data"`
			}
			if json.NewDecoder(resp.Body).Decode(&pveNodes) == nil && len(pveNodes.Data) > 0 {
				nodeName = pveNodes.Data[0].Node
			}
		}
		if nodeName == "" {
			nodeName = "pve"
		}
	}

	// 1. Try QEMU path first
	qemuPath := fmt.Sprintf("/nodes/%s/qemu/%d/status/%s", nodeName, vmid, action)
	resp, err := p.doRequest(ctx, http.MethodPost, qemuPath, nil)
	if err == nil {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)
		bodyStr := string(bodyBytes)
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			log.Printf("[Proxmox] Successfully executed '%s' on QEMU VM %d (node %s): %s", action, vmid, nodeName, bodyStr)
			return nil
		}
		lowerBody := strings.ToLower(bodyStr)
		if strings.Contains(lowerBody, "already running") || strings.Contains(lowerBody, "not running") || strings.Contains(lowerBody, "already stopped") {
			log.Printf("[Proxmox] VM %d state is already aligned with action '%s': %s", vmid, action, bodyStr)
			return nil
		}
		log.Printf("[Proxmox] QEMU '%s' on VM %d returned HTTP %d: %s. Trying LXC container path...", action, vmid, resp.StatusCode, bodyStr)
	}

	// 2. Try LXC path (in case it is an LXC Container)
	lxcPath := fmt.Sprintf("/nodes/%s/lxc/%d/status/%s", nodeName, vmid, action)
	respLXC, errLXC := p.doRequest(ctx, http.MethodPost, lxcPath, nil)
	if errLXC == nil {
		defer respLXC.Body.Close()
		bodyBytes, _ := io.ReadAll(respLXC.Body)
		bodyStr := string(bodyBytes)
		if respLXC.StatusCode >= 200 && respLXC.StatusCode < 300 {
			log.Printf("[Proxmox] Successfully executed '%s' on LXC %d (node %s): %s", action, vmid, nodeName, bodyStr)
			return nil
		}
		lowerBody := strings.ToLower(bodyStr)
		if strings.Contains(lowerBody, "already running") || strings.Contains(lowerBody, "not running") || strings.Contains(lowerBody, "already stopped") {
			log.Printf("[Proxmox] LXC %d state is already aligned with action '%s': %s", vmid, action, bodyStr)
			return nil
		}
		return fmt.Errorf("Proxmox error (HTTP %d): %s", respLXC.StatusCode, bodyStr)
	}

	if err != nil {
		return fmt.Errorf("failed to reach Proxmox at %s: %w", p.endpoint, err)
	}
	return fmt.Errorf("failed to execute power action '%s' on Proxmox VMID %d", action, vmid)
}

func (p *ProxmoxDriver) StartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	nodeName := ""
	if node != nil && node.ID != "" {
		nodeName = node.ID
	}
	return p.executeVMAction(ctx, nodeName, vmid, "start")
}

func (p *ProxmoxDriver) StopVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, force bool) error {
	nodeName := ""
	if node != nil && node.ID != "" {
		nodeName = node.ID
	}
	action := "shutdown"
	if force {
		action = "stop"
	}
	return p.executeVMAction(ctx, nodeName, vmid, action)
}

func (p *ProxmoxDriver) RestartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	nodeName := ""
	if node != nil && node.ID != "" {
		nodeName = node.ID
	}
	return p.executeVMAction(ctx, nodeName, vmid, "reboot")
}

func (p *ProxmoxDriver) GetConsoleTicket(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vmName string) (*ConsoleConnectionInfo, error) {
	sim := NewSimulatorDriver()
	info, err := sim.GetConsoleTicket(ctx, cluster, node, vmid, vmName)
	if err != nil {
		return nil, err
	}
	info.Protocol = "vnc"
	info.WebSocketURL = fmt.Sprintf("/api/v1/vms/%d/console/ws?ticket=%s", vmid, info.Ticket)
	return info, nil
}
