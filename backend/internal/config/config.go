package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port           string
	PostgresURL    string
	RedisAddr      string
	RedisPassword  string
	JWTSecret      string
	HypervisorMode string // "SIMULATOR" or "PRODUCTION"

	// Proxmox VE Settings
	ProxmoxEndpoint    string
	ProxmoxTokenID     string
	ProxmoxTokenSecret string
	ProxmoxInsecureSSL bool

	// VMware vCenter Settings
	VCenterHost        string
	VCenterUser        string
	VCenterPassword    string
	VCenterInsecureSSL bool
	VCenterDatacenter  string
}

func Load() *Config {
	port := getEnv("PORT", "8080")
	pgURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@postgres:5432/iaas_db?sslmode=disable")
	redisAddr := getEnv("REDIS_ADDR", "redis:6379")
	redisPass := getEnv("REDIS_PASSWORD", "")
	jwtSecret := getEnv("JWT_SECRET", "super-secret-iaas-private-cloud-key-32chars-min")
	hypervisorMode := getEnv("HYPERVISOR_MODE", "SIMULATOR")

	return &Config{
		Port:           port,
		PostgresURL:    pgURL,
		RedisAddr:      redisAddr,
		RedisPassword:  redisPass,
		JWTSecret:      jwtSecret,
		HypervisorMode: hypervisorMode,

		// Proxmox VE
		ProxmoxEndpoint:    getEnv("PROXMOX_ENDPOINT", "https://192.168.10.100:8006"),
		ProxmoxTokenID:     getEnv("PROXMOX_TOKEN_ID", "root@pam!iaas_controller"),
		ProxmoxTokenSecret: getEnv("PROXMOX_TOKEN_SECRET", ""),
		ProxmoxInsecureSSL: getEnv("PROXMOX_INSECURE_SSL", "true") == "true",

		// VMware vCenter
		VCenterHost:        getEnv("VCENTER_HOST", "192.168.10.50"),
		VCenterUser:        getEnv("VCENTER_USER", "administrator@vsphere.local"),
		VCenterPassword:    getEnv("VCENTER_PASSWORD", ""),
		VCenterInsecureSSL: getEnv("VCENTER_INSECURE_SSL", "true") == "true",
		VCenterDatacenter:  getEnv("VCENTER_DATACENTER", "Datacenter-01"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}
