package config

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
)

const (
	DefaultJWTSecretPlaceholder = "super-secret-iaas-private-cloud-key-32chars-min"
	EncryptedSecretPrefix       = "enc:v1:"
)

type Config struct {
	Port               string
	PostgresURL        string
	RedisAddr          string
	RedisPassword      string
	JWTSecret          string
	EncryptionKey      string
	HypervisorMode     string // "SIMULATOR", "DEVELOPMENT", or "PRODUCTION"
	CORSAllowedOrigins []string

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
	jwtSecret := getEnv("JWT_SECRET", DefaultJWTSecretPlaceholder)
	encryptionKey := getEnv("MASTER_ENCRYPTION_KEY", jwtSecret)
	hypervisorMode := strings.ToUpper(strings.TrimSpace(getEnv("HYPERVISOR_MODE", "SIMULATOR")))

	if hypervisorMode == "PRODUCTION" {
		if jwtSecret == "" || jwtSecret == DefaultJWTSecretPlaceholder || len(jwtSecret) < 32 {
			log.Println("[SECURITY WARNING] Running in PRODUCTION mode with default or weak JWT_SECRET! Please set a strong unique JWT_SECRET (>=32 chars).")
		}
	}

	rawOrigins := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://pal.co.id")
	var allowedOrigins []string
	for _, o := range strings.Split(rawOrigins, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}

	return &Config{
		Port:               port,
		PostgresURL:        pgURL,
		RedisAddr:          redisAddr,
		RedisPassword:      redisPass,
		JWTSecret:          jwtSecret,
		EncryptionKey:      encryptionKey,
		HypervisorMode:     hypervisorMode,
		CORSAllowedOrigins: allowedOrigins,

		// Proxmox VE
		ProxmoxEndpoint:    getEnv("PROXMOX_ENDPOINT", "https://192.168.10.100:8006"),
		ProxmoxTokenID:     getEnv("PROXMOX_TOKEN_ID", "root@pam!iaas_controller"),
		ProxmoxTokenSecret: getEnv("PROXMOX_TOKEN_SECRET", ""),
		ProxmoxInsecureSSL: getEnv("PROXMOX_INSECURE_SSL", "false") == "true",

		// VMware vCenter
		VCenterHost:        getEnv("VCENTER_HOST", "192.168.10.50"),
		VCenterUser:        getEnv("VCENTER_USER", "administrator@vsphere.local"),
		VCenterPassword:    getEnv("VCENTER_PASSWORD", ""),
		VCenterInsecureSSL: getEnv("VCENTER_INSECURE_SSL", "false") == "true",
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

// EncryptSecret encrypts a sensitive secret using AES-256-GCM and prefixes with "enc:v1:"
func EncryptSecret(plaintext, keyMaterial string) string {
	if plaintext == "" || strings.HasPrefix(plaintext, EncryptedSecretPrefix) {
		return plaintext
	}
	if keyMaterial == "" {
		keyMaterial = getEnv("MASTER_ENCRYPTION_KEY", getEnv("JWT_SECRET", DefaultJWTSecretPlaceholder))
	}
	hash := sha256.Sum256([]byte(keyMaterial))
	block, err := aes.NewCipher(hash[:])
	if err != nil {
		return plaintext
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return plaintext
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return plaintext
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return EncryptedSecretPrefix + base64.StdEncoding.EncodeToString(sealed)
}

// DecryptSecret decrypts an "enc:v1:" AES-256-GCM secret, or returns plaintext for legacy unencrypted records
func DecryptSecret(stored, keyMaterial string) string {
	if stored == "" || !strings.HasPrefix(stored, EncryptedSecretPrefix) {
		return stored
	}
	if keyMaterial == "" {
		keyMaterial = getEnv("MASTER_ENCRYPTION_KEY", getEnv("JWT_SECRET", DefaultJWTSecretPlaceholder))
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(stored, EncryptedSecretPrefix))
	if err != nil {
		return ""
	}
	hash := sha256.Sum256([]byte(keyMaterial))
	block, err := aes.NewCipher(hash[:])
	if err != nil {
		return ""
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil || len(raw) < gcm.NonceSize() {
		return ""
	}
	nonce := raw[:gcm.NonceSize()]
	ciphertext := raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return ""
	}
	return string(plain)
}
