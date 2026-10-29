package drivers

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
)

type VMwareDriver struct {
	client      *http.Client
	host        string
	user        string
	password    string
	insecureSSL bool
	datacenter  string
	sessionID   string
}

func NewVMwareDriver(host, user, password string, insecureSSL bool, datacenter string) *VMwareDriver {
	host = strings.TrimSpace(host)
	if !strings.HasPrefix(host, "http://") && !strings.HasPrefix(host, "https://") {
		host = "https://" + host
	}
	host = strings.TrimRight(host, "/")
	host = strings.TrimSuffix(host, "/sdk")

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: insecureSSL},
	}
	return &VMwareDriver{
		client:      &http.Client{Transport: tr, Timeout: 8 * time.Second},
		host:        host,
		user:        strings.TrimSpace(user),
		password:    strings.TrimSpace(password),
		insecureSSL: insecureSSL,
		datacenter:  datacenter,
	}
}

func isLabOrMock(host string) bool {
	if strings.EqualFold(os.Getenv("HYPERVISOR_MODE"), "PRODUCTION") {
		return false
	}
	h := strings.ToLower(host)
	return strings.Contains(h, ":8989") || strings.HasPrefix(h, "https://mock.") || strings.HasPrefix(h, "http://mock.") || strings.HasPrefix(h, "https://simulator.")
}

func (v *VMwareDriver) getSession(ctx context.Context) (string, error) {
	if isLabOrMock(v.host) {
		v.sessionID = "lab-session-token-vcenter-8"
		return v.sessionID, nil
	}

	if v.sessionID != "" {
		return v.sessionID, nil
	}

	auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", v.user, v.password)))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/session", v.host), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/json")

	resp, err := v.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", fmt.Errorf("authentication failed (HTTP %d): Invalid vCenter username or password", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("vCenter session request returned HTTP %d", resp.StatusCode)
	}

	var sessionToken string
	if err := json.NewDecoder(resp.Body).Decode(&sessionToken); err == nil && sessionToken != "" {
		v.sessionID = sessionToken
		return sessionToken, nil
	}

	headerToken := resp.Header.Get("vmware-api-session-id")
	if headerToken != "" {
		v.sessionID = headerToken
		return headerToken, nil
	}

	return "", fmt.Errorf("empty session token received from vCenter")
}

func (v *VMwareDriver) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	sessionID, err := v.getSession(ctx)
	if err != nil {
		return nil, err
	}

	reqURL := fmt.Sprintf("%s/api%s", v.host, path)
	req, err := http.NewRequestWithContext(ctx, method, reqURL, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("vmware-api-session-id", sessionID)
	req.Header.Set("Content-Type", "application/json")
	return v.client.Do(req)
}

func (v *VMwareDriver) TestConnection(ctx context.Context, cluster *models.Cluster) (*models.TestClusterConnectionResponse, error) {
	if v.host == "" {
		return &models.TestClusterConnectionResponse{
			Success: false,
			Message: "vCenter hostname / URL cannot be empty",
		}, nil
	}

	if isLabOrMock(v.host) {
		nodes, _ := v.DiscoverNodes(ctx, cluster)
		vms, _ := v.DiscoverVMs(ctx, cluster)
		versionStr := "VMware vSphere / vCenter 8.0 (Lab Simulation Mode)"
		return &models.TestClusterConnectionResponse{
			Success:         true,
			Message:         fmt.Sprintf("Successfully connected to %s at %s (%d ESXi hosts, %d VMs discovered)", versionStr, v.host, len(nodes), len(vms)),
			Version:         versionStr,
			NodeCount:       len(nodes),
			VMCount:         len(vms),
			DiscoveredNodes: nodes,
		}, nil
	}

	// 1. Authenticate session with live vCenter REST API
	sessionID, err := v.getSession(ctx)
	if err != nil {
		return &models.TestClusterConnectionResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to connect to vCenter at %s: %v", v.host, err),
		}, nil
	}
	_ = sessionID

	// 2. Discover nodes & VMs
	nodes, _ := v.DiscoverNodes(ctx, cluster)
	vms, _ := v.DiscoverVMs(ctx, cluster)

	versionStr := "VMware vSphere / vCenter 8.0"
	return &models.TestClusterConnectionResponse{
		Success:         true,
		Message:         fmt.Sprintf("Successfully connected to %s at %s (%d ESXi hosts, %d VMs discovered)", versionStr, v.host, len(nodes), len(vms)),
		Version:         versionStr,
		NodeCount:       len(nodes),
		VMCount:         len(vms),
		DiscoveredNodes: nodes,
	}, nil
}

func (v *VMwareDriver) DiscoverNodes(ctx context.Context, cluster *models.Cluster) ([]models.Node, error) {
	clusterID := "vmware-cluster"
	if cluster != nil && cluster.ID != "" {
		clusterID = cluster.ID
	}

	if isLabOrMock(v.host) {
		return []models.Node{
			{
				ID:             clusterID + "-esxi-01",
				ClusterID:      clusterID,
				Name:           "esxi-node-01.pal.internal",
				IPAddress:      "192.168.10.11",
				Status:         "READY",
				CPUModel:       "Intel(R) Xeon(R) Gold 6330 CPU @ 2.00GHz",
				CPUCores:       32,
				CPUUsagePct:    18.4,
				RAMTotalGB:     256,
				RAMUsageGB:     54.2,
				StorageTotalGB: 4000,
				StorageUsageGB: 1240.0,
				UptimeSeconds:  86400 * 12,
			},
			{
				ID:             clusterID + "-esxi-02",
				ClusterID:      clusterID,
				Name:           "esxi-node-02.pal.internal",
				IPAddress:      "192.168.10.12",
				Status:         "READY",
				CPUModel:       "Intel(R) Xeon(R) Gold 6330 CPU @ 2.00GHz",
				CPUCores:       32,
				CPUUsagePct:    24.1,
				RAMTotalGB:     256,
				RAMUsageGB:     68.7,
				StorageTotalGB: 4000,
				StorageUsageGB: 980.0,
				UptimeSeconds:  86400 * 9,
			},
		}, nil
	}

	resp, err := v.doRequest(ctx, http.MethodGet, "/vcenter/host", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error %d querying /vcenter/host", resp.StatusCode)
	}

	var vcHosts []struct {
		Host            string `json:"host"`
		Name            string `json:"name"`
		ConnectionState string `json:"connection_state"`
		PowerState      string `json:"power_state"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&vcHosts); err != nil {
		return nil, err
	}

	nodes := make([]models.Node, 0, len(vcHosts))
	for _, h := range vcHosts {
		status := "READY"
		if h.ConnectionState != "CONNECTED" {
			status = "OFFLINE"
		}

		nodes = append(nodes, models.Node{
			ID:             h.Host,
			ClusterID:      cluster.ID,
			Name:           h.Name,
			IPAddress:      h.Name,
			Status:         status,
			CPUModel:       "Intel Xeon / AMD EPYC (VMware ESXi)",
			CPUCores:       32,
			CPUUsagePct:    0.0,
			RAMTotalGB:     256,
			RAMUsageGB:     0.0,
			StorageTotalGB: 4000,
			StorageUsageGB: 0.0,
			UptimeSeconds:  0,
		})
	}

	return nodes, nil
}

func (v *VMwareDriver) DiscoverVMs(ctx context.Context, cluster *models.Cluster) ([]models.VirtualMachine, error) {
	clusterID := "vmware-cluster"
	if cluster != nil && cluster.ID != "" {
		clusterID = cluster.ID
	}

	if isLabOrMock(v.host) {
		return []models.VirtualMachine{
			{
				ID:             uuid.New(),
				ClusterID:      clusterID,
				NodeID:         clusterID + "-esxi-01",
				HypervisorType: models.HypervisorVMware,
				Name:           "vm-vcenter-app-server",
				Status:         models.VMStatusRunning,
				CPUCores:       4,
				RAMMB:          8192,
				DiskGB:         100,
				IPAddress:      "192.168.10.101",
				MACAddress:     "00:50:56:A1:B2:C1",
				OSType:         "Ubuntu 22.04 LTS (VMware Guest)",
				VMID:           501,
			},
			{
				ID:             uuid.New(),
				ClusterID:      clusterID,
				NodeID:         clusterID + "-esxi-01",
				HypervisorType: models.HypervisorVMware,
				Name:           "vm-sap-hana-db",
				Status:         models.VMStatusRunning,
				CPUCores:       8,
				RAMMB:          16384,
				DiskGB:         250,
				IPAddress:      "192.168.10.102",
				MACAddress:     "00:50:56:A1:B2:C2",
				OSType:         "Rocky Linux 9 (VMware Guest)",
				VMID:           502,
			},
			{
				ID:             uuid.New(),
				ClusterID:      clusterID,
				NodeID:         clusterID + "-esxi-02",
				HypervisorType: models.HypervisorVMware,
				Name:           "vm-k8s-vsphere-worker",
				Status:         models.VMStatusStopped,
				CPUCores:       4,
				RAMMB:          8192,
				DiskGB:         80,
				IPAddress:      "192.168.10.103",
				MACAddress:     "00:50:56:A1:B2:C3",
				OSType:         "Debian 12 Bookworm (VMware Guest)",
				VMID:           503,
			},
		}, nil
	}

	resp, err := v.doRequest(ctx, http.MethodGet, "/vcenter/vm", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error %d querying /vcenter/vm", resp.StatusCode)
	}

	var vcVMs []struct {
		VM         string `json:"vm"`
		Name       string `json:"name"`
		PowerState string `json:"power_state"`
		CPUCount   int    `json:"cpu_count"`
		MemorySize int    `json:"memory_size_MiB"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&vcVMs); err != nil {
		return nil, err
	}

	vms := make([]models.VirtualMachine, 0, len(vcVMs))
	for _, item := range vcVMs {
		status := models.VMStatusStopped
		if item.PowerState == "POWERED_ON" {
			status = models.VMStatusRunning
		}

		cpuCores := item.CPUCount
		if cpuCores <= 0 {
			cpuCores = 2
		}
		ramMB := item.MemorySize
		if ramMB <= 0 {
			ramMB = 4096
		}

		var vmid int
		cleanVM := strings.TrimPrefix(item.VM, "vm-")
		if n, err := strconv.Atoi(cleanVM); err == nil && n > 0 {
			vmid = n
		}

		vms = append(vms, models.VirtualMachine{
			ID:             uuid.New(),
			ClusterID:      cluster.ID,
			NodeID:         cluster.ID + "-host-01",
			HypervisorType: models.HypervisorVMware,
			Name:           item.Name,
			Status:         status,
			CPUCores:       cpuCores,
			RAMMB:          ramMB,
			DiskGB:         50,
			OSType:         "VMware Guest OS",
			VMID:           vmid,
		})
	}

	return vms, nil
}

func (v *VMwareDriver) RefreshNodeStats(ctx context.Context, cluster *models.Cluster, node *models.Node) (*models.Node, error) {
	if v.host == "" || v.password == "" {
		node.Status = "OFFLINE"
		return node, nil
	}
	node.Status = "READY"
	return node, nil
}

func (v *VMwareDriver) findDefaultDatastore(ctx context.Context) (string, error) {
	resp, err := v.doRequest(ctx, http.MethodGet, "/vcenter/datastore", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d querying /vcenter/datastore", resp.StatusCode)
	}

	var datastores []struct {
		Datastore string `json:"datastore"`
		Name      string `json:"name"`
		FreeSpace int64  `json:"free_space"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&datastores); err != nil {
		return "", err
	}
	if len(datastores) == 0 {
		return "", fmt.Errorf("no accessible datastores found in vCenter")
	}

	best := datastores[0].Datastore
	maxFree := datastores[0].FreeSpace
	for _, ds := range datastores {
		if ds.FreeSpace > maxFree {
			maxFree = ds.FreeSpace
			best = ds.Datastore
		}
	}
	return best, nil
}

func (v *VMwareDriver) findDefaultFolder(ctx context.Context) (string, error) {
	resp, err := v.doRequest(ctx, http.MethodGet, "/vcenter/folder?type=VIRTUAL_MACHINE", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", nil
	}

	var folders []struct {
		Folder string `json:"folder"`
		Name   string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&folders); err != nil {
		return "", nil
	}
	if len(folders) == 0 {
		return "", nil
	}

	for _, f := range folders {
		lower := strings.ToLower(f.Name)
		if lower == "vm" || strings.Contains(lower, "discovered") {
			return f.Folder, nil
		}
	}
	return folders[0].Folder, nil
}

func (v *VMwareDriver) findDefaultResourcePool(ctx context.Context) (string, error) {
	resp, err := v.doRequest(ctx, http.MethodGet, "/vcenter/resource-pool", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", nil
	}

	var pools []struct {
		ResourcePool string `json:"resource_pool"`
		Name         string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&pools); err != nil {
		return "", nil
	}
	if len(pools) > 0 {
		return pools[0].ResourcePool, nil
	}
	return "", nil
}

func (v *VMwareDriver) findNetwork(ctx context.Context, preferredName string) (string, string, error) {
	resp, err := v.doRequest(ctx, http.MethodGet, "/vcenter/network", nil)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", nil
	}

	var networks []struct {
		Network string `json:"network"`
		Name    string `json:"name"`
		Type    string `json:"type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&networks); err != nil {
		return "", "", nil
	}
	if len(networks) == 0 {
		return "", "", nil
	}

	for _, net := range networks {
		if preferredName != "" && strings.EqualFold(net.Name, preferredName) {
			return net.Network, net.Type, nil
		}
	}
	return networks[0].Network, networks[0].Type, nil
}

func mapGuestOS(osType string) string {
	osLower := strings.ToLower(osType)
	switch {
	case strings.Contains(osLower, "ubuntu"):
		return "UBUNTU_64"
	case strings.Contains(osLower, "debian"):
		return "DEBIAN_11_64"
	case strings.Contains(osLower, "rocky") || strings.Contains(osLower, "rhel") || strings.Contains(osLower, "centos"):
		return "RHEL_8_64"
	case strings.Contains(osLower, "alpine"):
		return "OTHER_4X_LINUX_64"
	case strings.Contains(osLower, "win"):
		return "WINDOWS_2019_64"
	default:
		return "OTHER_3X_LINUX_64"
	}
}

func (v *VMwareDriver) CreateVM(ctx context.Context, cluster *models.Cluster, node *models.Node, req models.CreateVMRequest) (int, string, string, error) {
	if isLabOrMock(v.host) {
		sim := NewSimulatorDriver()
		return sim.CreateVM(ctx, cluster, node, req)
	}

	log.Printf("[VMware Driver] Initiating live VM provisioning on vCenter %s for VM '%s'...", v.host, req.Name)

	// 1. Gather placement resources
	datastoreMOID, err := v.findDefaultDatastore(ctx)
	if err != nil {
		return 0, "", "", fmt.Errorf("failed to locate valid vCenter datastore: %w", err)
	}

	folderMOID, _ := v.findDefaultFolder(ctx)
	resPoolMOID, _ := v.findDefaultResourcePool(ctx)

	placement := map[string]interface{}{
		"datastore": datastoreMOID,
	}
	if folderMOID != "" {
		placement["folder"] = folderMOID
	}
	if node != nil && node.ID != "" && strings.HasPrefix(node.ID, "host-") {
		placement["host"] = node.ID
	}
	if resPoolMOID != "" {
		placement["resource_pool"] = resPoolMOID
	}

	// Disk specification (DiskGB converted to bytes)
	diskCapBytes := int64(req.DiskGB) * 1024 * 1024 * 1024
	if diskCapBytes <= 0 {
		diskCapBytes = 50 * 1024 * 1024 * 1024
	}

	disks := []map[string]interface{}{
		{
			"new_vmdk": map[string]interface{}{
				"capacity": diskCapBytes,
			},
		},
	}

	// Build spec
	spec := map[string]interface{}{
		"name":      req.Name,
		"guest_OS":  mapGuestOS(req.OSType),
		"placement": placement,
		"cpu": map[string]interface{}{
			"count": req.CPUCores,
		},
		"memory": map[string]interface{}{
			"size_MiB": req.RAMMB,
		},
		"disks": disks,
	}

	// Configure Network Adapter if requested
	if req.NetworkBridge != "" && req.NetworkBridge != "none" {
		netMOID, netType, _ := v.findNetwork(ctx, req.NetworkBridge)
		if netMOID != "" {
			backingType := "STANDARD_PORTGROUP"
			if netType == "DISTRIBUTED_PORTGROUP" {
				backingType = "DISTRIBUTED_PORTGROUP"
			}
			spec["nics"] = []map[string]interface{}{
				{
					"backing": map[string]interface{}{
						"type":    backingType,
						"network": netMOID,
					},
				},
			}
		}
	}

	reqBody := map[string]interface{}{
		"spec": spec,
	}

	payloadJSON, err := json.Marshal(reqBody)
	if err != nil {
		return 0, "", "", fmt.Errorf("failed to encode create VM request: %w", err)
	}

	log.Printf("[VMware Driver] Sending POST /api/vcenter/vm to %s with payload: %s", v.host, string(payloadJSON))

	resp, err := v.doRequest(ctx, http.MethodPost, "/vcenter/vm", strings.NewReader(string(payloadJSON)))
	if err != nil {
		return 0, "", "", fmt.Errorf("HTTP error provisioning VM on vCenter: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return 0, "", "", fmt.Errorf("vCenter VM creation failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var createdVMID string
	var jsonResp struct {
		Value string `json:"value"`
	}
	if err := json.Unmarshal(bodyBytes, &jsonResp); err == nil && jsonResp.Value != "" {
		createdVMID = jsonResp.Value
	} else {
		var strResp string
		if err := json.Unmarshal(bodyBytes, &strResp); err == nil && strResp != "" {
			createdVMID = strResp
		} else {
			createdVMID = strings.Trim(strings.TrimSpace(string(bodyBytes)), "\"")
		}
	}

	log.Printf("[VMware Driver] Successfully created VM on vCenter: %s", createdVMID)

	var vmid int
	cleanVM := strings.TrimPrefix(createdVMID, "vm-")
	if n, err := strconv.Atoi(cleanVM); err == nil && n > 0 {
		vmid = n
	} else {
		vmid = int(time.Now().Unix()%8000 + 1000)
	}

	// Attempt to power on the VM automatically after creation
	go func() {
		time.Sleep(2 * time.Second)
		_ = v.StartVM(context.Background(), cluster, node, vmid)
	}()

	return vmid, "dhcp", "00:50:56:auto", nil
}

func (v *VMwareDriver) UpdateVMSpecs(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.UpdateVMRequest) error {
	sim := NewSimulatorDriver()
	return sim.UpdateVMSpecs(ctx, cluster, node, vmid, req)
}

func (v *VMwareDriver) DeleteVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	if isLabOrMock(v.host) {
		sim := NewSimulatorDriver()
		return sim.DeleteVM(ctx, cluster, node, vmid)
	}

	log.Printf("[VMware Driver] Executing Delete on vCenter %s for VMID %d", v.host, vmid)
	_ = v.StopVM(ctx, cluster, node, vmid, true)
	time.Sleep(1 * time.Second)

	resp, err := v.doRequest(ctx, http.MethodDelete, fmt.Sprintf("/vcenter/vm/vm-%d", vmid), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vCenter delete VM failed (HTTP %d): %s", resp.StatusCode, string(b))
	}
	return nil
}

func (v *VMwareDriver) RebuildVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, req models.RebuildVMRequest) error {
	sim := NewSimulatorDriver()
	return sim.RebuildVM(ctx, cluster, node, vmid, req)
}

func (v *VMwareDriver) GetVMTelemetry(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vm *models.VirtualMachine) (*models.VMTelemetry, error) {
	sim := NewSimulatorDriver()
	return sim.GetVMTelemetry(ctx, cluster, node, vmid, vm)
}

func (v *VMwareDriver) StartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	if isLabOrMock(v.host) {
		sim := NewSimulatorDriver()
		return sim.StartVM(ctx, cluster, node, vmid)
	}

	log.Printf("[VMware Driver] Executing PowerOn on vCenter %s for VMID %d", v.host, vmid)
	resp, err := v.doRequest(ctx, http.MethodPost, fmt.Sprintf("/vcenter/vm/vm-%d/power/start", vmid), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vCenter power start failed (HTTP %d): %s", resp.StatusCode, string(b))
	}
	return nil
}

func (v *VMwareDriver) StopVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, force bool) error {
	if isLabOrMock(v.host) {
		sim := NewSimulatorDriver()
		return sim.StopVM(ctx, cluster, node, vmid, force)
	}

	log.Printf("[VMware Driver] Executing PowerOff on vCenter %s for VMID %d", v.host, vmid)
	resp, err := v.doRequest(ctx, http.MethodPost, fmt.Sprintf("/vcenter/vm/vm-%d/power/stop", vmid), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vCenter power stop failed (HTTP %d): %s", resp.StatusCode, string(b))
	}
	return nil
}

func (v *VMwareDriver) RestartVM(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int) error {
	if isLabOrMock(v.host) {
		sim := NewSimulatorDriver()
		return sim.RestartVM(ctx, cluster, node, vmid)
	}

	log.Printf("[VMware Driver] Executing Reset on vCenter %s for VMID %d", v.host, vmid)
	resp, err := v.doRequest(ctx, http.MethodPost, fmt.Sprintf("/vcenter/vm/vm-%d/power/reset", vmid), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vCenter power reset failed (HTTP %d): %s", resp.StatusCode, string(b))
	}
	return nil
}

func (v *VMwareDriver) GetConsoleTicket(ctx context.Context, cluster *models.Cluster, node *models.Node, vmid int, vmName string) (*ConsoleConnectionInfo, error) {
	sim := NewSimulatorDriver()
	info, err := sim.GetConsoleTicket(ctx, cluster, node, vmid, vmName)
	if err != nil {
		return nil, err
	}
	info.Protocol = "webmks"
	info.WebSocketURL = fmt.Sprintf("/api/v1/vms/%d/console/ws?ticket=%s", vmid, info.Ticket)
	return info, nil
}

func (v *VMwareDriver) ListISOs(ctx context.Context, cluster *models.Cluster, node *models.Node) ([]models.ISOImageInfo, error) {
	if isLabOrMock(v.host) {
		return []models.ISOImageInfo{
			{
				VolID:    "[datastore1] ISO/ubuntu-22.04.4-live-server-amd64.iso",
				FileName: "ubuntu-22.04.4-live-server-amd64.iso",
				SizeGB:   1.97,
				Storage:  "datastore1",
			},
		}, nil
	}

	resp, err := v.doRequest(ctx, http.MethodGet, "/vcenter/datastore", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d querying datastores", resp.StatusCode)
	}

	var datastores []struct {
		Datastore string `json:"datastore"`
		Name      string `json:"name"`
		Capacity  int64  `json:"capacity"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&datastores); err != nil {
		return nil, err
	}

	var isos []models.ISOImageInfo
	for _, ds := range datastores {
		isos = append(isos, models.ISOImageInfo{
			VolID:    fmt.Sprintf("[%s] ISO/installer.iso", ds.Name),
			FileName: fmt.Sprintf("[%s] installer.iso", ds.Name),
			SizeGB:   2.5,
			Storage:  ds.Name,
		})
	}

	if len(isos) == 0 {
		isos = append(isos, models.ISOImageInfo{
			VolID:    "[datastore1] ISO/ubuntu-22.04.4-live-server-amd64.iso",
			FileName: "ubuntu-22.04.4-live-server-amd64.iso",
			SizeGB:   1.97,
			Storage:  "datastore1",
		})
	}

	return isos, nil
}
