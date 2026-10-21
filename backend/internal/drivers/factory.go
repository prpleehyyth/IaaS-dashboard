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
