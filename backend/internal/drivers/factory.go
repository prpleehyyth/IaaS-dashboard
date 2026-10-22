package drivers

import (
	"iaas-dashboard/internal/config"
	"iaas-dashboard/internal/models"
)

type DriverFactory struct {
	cfg *config.Config
}

func NewDriverFactory(cfg *config.Config) *DriverFactory {
	return &DriverFactory{cfg: cfg}
}

func (f *DriverFactory) GetDriver(clusterType models.HypervisorType) HypervisorDriver {
	if f.cfg.HypervisorMode == "SIMULATOR" {
		return NewSimulatorDriver()
	}

	switch clusterType {
	case models.HypervisorProxmox:
		return NewProxmoxDriver(f.cfg.ProxmoxEndpoint, f.cfg.ProxmoxTokenID, f.cfg.ProxmoxTokenSecret, f.cfg.ProxmoxInsecureSSL)
	case models.HypervisorVMware:
		return NewVMwareDriver(f.cfg.VCenterHost, f.cfg.VCenterUser, f.cfg.VCenterPassword, f.cfg.VCenterInsecureSSL, f.cfg.VCenterDatacenter)
	default:
		return NewSimulatorDriver()
	}
}

func (f *DriverFactory) GetDriverForCluster(cluster *models.Cluster) HypervisorDriver {
	if f.cfg.HypervisorMode == "SIMULATOR" {
		return NewSimulatorDriver()
	}

	switch cluster.Type {
	case models.HypervisorProxmox:
		endpoint := cluster.Endpoint
		if endpoint == "" {
			endpoint = f.cfg.ProxmoxEndpoint
		}
		tokenID := cluster.AuthUser
		tokenSecret := cluster.AuthSecret
		if tokenID == "" {
			tokenID = f.cfg.ProxmoxTokenID
			tokenSecret = f.cfg.ProxmoxTokenSecret
		}
		return NewProxmoxDriver(endpoint, tokenID, tokenSecret, cluster.InsecureSSL)

	case models.HypervisorVMware:
		endpoint := cluster.Endpoint
		if endpoint == "" {
			endpoint = f.cfg.VCenterHost
		}
		user := cluster.AuthUser
		secret := cluster.AuthSecret
		if user == "" {
			user = f.cfg.VCenterUser
			secret = f.cfg.VCenterPassword
		}
		dc := cluster.Datacenter
		if dc == "" {
			dc = f.cfg.VCenterDatacenter
		}
		return NewVMwareDriver(endpoint, user, secret, cluster.InsecureSSL, dc)

	default:
		return NewSimulatorDriver()
	}
}

func (f *DriverFactory) CreateDriver(hType models.HypervisorType, endpoint, user, secret string, insecure bool, dc string) HypervisorDriver {
	if f.cfg.HypervisorMode == "SIMULATOR" {
		return NewSimulatorDriver()
	}

	switch hType {
	case models.HypervisorProxmox:
		if endpoint == "" {
			endpoint = f.cfg.ProxmoxEndpoint
		}
		if user == "" {
			user = f.cfg.ProxmoxTokenID
			secret = f.cfg.ProxmoxTokenSecret
		}
		return NewProxmoxDriver(endpoint, user, secret, insecure)

	case models.HypervisorVMware:
		if endpoint == "" {
			endpoint = f.cfg.VCenterHost
		}
		if user == "" {
			user = f.cfg.VCenterUser
			secret = f.cfg.VCenterPassword
		}
		if dc == "" {
			dc = f.cfg.VCenterDatacenter
		}
		return NewVMwareDriver(endpoint, user, secret, insecure, dc)

	default:
		return NewSimulatorDriver()
	}
}
