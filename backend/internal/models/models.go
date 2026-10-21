package models

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type UserRole string

const (
	RoleAdmin    UserRole = "ADMIN"
	RoleOperator UserRole = "OPERATOR"
)

type HypervisorType string

const (
	HypervisorVMware  HypervisorType = "VMWARE"
	HypervisorProxmox HypervisorType = "PROXMOX"
)

type VMStatus string

const (
	VMStatusRunning  VMStatus = "RUNNING"
	VMStatusStopped  VMStatus = "STOPPED"
	VMStatusStarting VMStatus = "STARTING"
	VMStatusStopping VMStatus = "STOPPING"
	VMStatusError    VMStatus = "ERROR"
)

// Tenant Model
type Tenant struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Slug         string    `json:"slug" db:"slug"`
	Description  string    `json:"description" db:"description"`
	MaxCPU       int       `json:"max_cpu" db:"max_cpu"`
	MaxRAMGB     int       `json:"max_ram_gb" db:"max_ram_gb"`
	MaxStorageGB int       `json:"max_storage_gb" db:"max_storage_gb"`
	MaxVMs       int       `json:"max_vms" db:"max_vms"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`

	// Runtime computed quota stats
	UsedCPU       int `json:"used_cpu,omitempty" db:"-"`
	UsedRAMGB     int `json:"used_ram_gb,omitempty" db:"-"`
	UsedStorageGB int `json:"used_storage_gb,omitempty" db:"-"`
	UsedVMs       int `json:"used_vms,omitempty" db:"-"`
}

// User Model
type User struct {
	ID           uuid.UUID   `json:"id" db:"id"`
	TenantID     uuid.UUID   `json:"tenant_id" db:"tenant_id"`
	Username     string      `json:"username" db:"username"`
	Email        string      `json:"email" db:"email"`
	PasswordHash string      `json:"-" db:"password_hash"`
	FullName     string      `json:"full_name" db:"full_name"`
	Role         UserRole    `json:"role" db:"role"`
	Status       string      `json:"status" db:"status"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at" db:"updated_at"`

	// Relational details
	TenantName      string      `json:"tenant_name,omitempty" db:"tenant_name"`
	AssignedVMCount int         `json:"assigned_vm_count" db:"-"`
	AssignedVMIDs   []uuid.UUID `json:"assigned_vm_ids,omitempty" db:"-"`
}

type CreateUserRequest struct {
	Username    string      `json:"username" binding:"required"`
	Email       string      `json:"email" binding:"required,email"`
	Password    string      `json:"password" binding:"required,min=6"`
	FullName    string      `json:"full_name" binding:"required"`
	Role        UserRole    `json:"role" binding:"required"`
	TenantID    *uuid.UUID  `json:"tenant_id"`
	AssignedVMs []uuid.UUID `json:"assigned_vms"`
}

type AssignVMsRequest struct {
	VMIDs []uuid.UUID `json:"vm_ids"`
}


// Cluster Model
type Cluster struct {
	ID             string         `json:"id" db:"id"`
	Name           string         `json:"name" db:"name"`
	Type           HypervisorType `json:"type" db:"type"`
	Datacenter     string         `json:"datacenter" db:"datacenter"`
	Endpoint       string         `json:"endpoint" db:"endpoint"`
	Status         string         `json:"status" db:"status"`
	TotalCPUCores  int            `json:"total_cpu_cores" db:"total_cpu_cores"`
	TotalRAMGB     int            `json:"total_ram_gb" db:"total_ram_gb"`
	TotalStorageTB float64        `json:"total_storage_tb" db:"total_storage_tb"`
	Description    string         `json:"description" db:"description"`
	CreatedAt      time.Time      `json:"created_at" db:"created_at"`

	// Relational attachments
	Nodes []Node `json:"nodes,omitempty" db:"-"`
	VMs   []VirtualMachine `json:"vms,omitempty" db:"-"`
}

// Node Model
type Node struct {
	ID             string    `json:"id" db:"id"`
	ClusterID      string    `json:"cluster_id" db:"cluster_id"`
	Name           string    `json:"name" db:"name"`
	IPAddress      string    `json:"ip_address" db:"ip_address"`
	Status         string    `json:"status" db:"status"`
	CPUModel       string    `json:"cpu_model" db:"cpu_model"`
	CPUCores       int       `json:"cpu_cores" db:"cpu_cores"`
	CPUUsagePct    float64   `json:"cpu_usage_pct" db:"cpu_usage_pct"`
	RAMTotalGB     int       `json:"ram_total_gb" db:"ram_total_gb"`
	RAMUsageGB     float64   `json:"ram_usage_gb" db:"ram_usage_gb"`
	StorageTotalGB int       `json:"storage_total_gb" db:"storage_total_gb"`
	StorageUsageGB float64   `json:"storage_usage_gb" db:"storage_usage_gb"`
	UptimeSeconds  int64     `json:"uptime_seconds" db:"uptime_seconds"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// VirtualMachine Model
type VirtualMachine struct {
	ID             uuid.UUID      `json:"id" db:"id"`
	TenantID       uuid.UUID      `json:"tenant_id" db:"tenant_id"`
	ClusterID      string         `json:"cluster_id" db:"cluster_id"`
	NodeID         string         `json:"node_id" db:"node_id"`
	HypervisorType HypervisorType `json:"hypervisor_type" db:"hypervisor_type"`
	Name           string         `json:"name" db:"name"`
	Status         VMStatus       `json:"status" db:"status"`
	CPUCores       int            `json:"cpu_cores" db:"cpu_cores"`
	RAMMB          int            `json:"ram_mb" db:"ram_mb"`
	DiskGB         int            `json:"disk_gb" db:"disk_gb"`
	IPAddress      string         `json:"ip_address" db:"ip_address"`
	MACAddress     string         `json:"mac_address" db:"mac_address"`
	OSType         string         `json:"os_type" db:"os_type"`
	ConsolePort    int            `json:"console_port" db:"console_port"`
	VMID           int            `json:"vmid" db:"vmid"`
	CreatedBy      uuid.UUID      `json:"created_by" db:"created_by"`
	CreatedAt      time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at" db:"updated_at"`

	// Relational details
	ClusterName string `json:"cluster_name,omitempty" db:"cluster_name"`
	NodeName    string `json:"node_name,omitempty" db:"node_name"`
	TenantName  string `json:"tenant_name,omitempty" db:"tenant_name"`
}

// VMActivityLog Model
type VMActivityLog struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	TenantID  uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	VMID      *uuid.UUID `json:"vm_id" db:"vm_id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	Action    string     `json:"action" db:"action"`
	Status    string     `json:"status" db:"status"`
	Details   string     `json:"details" db:"details"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	Username  string     `json:"username,omitempty" db:"username"`
	VMName    string     `json:"vm_name,omitempty" db:"vm_name"`
}

// ResourceMeteringSample Model
type ResourceMeteringSample struct {
	ID         int64     `json:"id" db:"id"`
	TenantID   uuid.UUID `json:"tenant_id" db:"tenant_id"`
	VMID       uuid.UUID `json:"vm_id" db:"vm_id"`
	CPUCores   int       `json:"cpu_cores" db:"cpu_cores"`
	RAMMB      int       `json:"ram_mb" db:"ram_mb"`
	DiskGB     int       `json:"disk_gb" db:"disk_gb"`
	Status     string    `json:"status" db:"status"`
	RecordedAt time.Time `json:"recorded_at" db:"recorded_at"`
}

// JWT Claims
type TokenClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Username string    `json:"username"`
	Role     UserRole  `json:"role"`
	jwt.RegisteredClaims
}

// Requests & DTOs
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateVMRequest struct {
	Name           string         `json:"name" binding:"required"`
	ClusterID      string         `json:"cluster_id" binding:"required"`
	NodeID         string         `json:"node_id" binding:"required"`
	HypervisorType HypervisorType `json:"hypervisor_type" binding:"required"`
	CPUCores       int            `json:"cpu_cores" binding:"required,min=1,max=64"`
	RAMMB          int            `json:"ram_mb" binding:"required,min=512"`
	DiskGB         int            `json:"disk_gb" binding:"required,min=10"`
	OSType         string         `json:"os_type" binding:"required"`
}

type UpdateVMRequest struct {
	Name     string `json:"name"`
	CPUCores int    `json:"cpu_cores" binding:"omitempty,min=1,max=64"`
	RAMMB    int    `json:"ram_mb" binding:"omitempty,min=512"`
	DiskGB   int    `json:"disk_gb" binding:"omitempty,min=10"`
}

type VMActionRequest struct {
	Action string `json:"action" binding:"required"` // "start", "stop", "restart"
	Force  bool   `json:"force"`
}

type ConsoleSessionResponse struct {
	VMID         string `json:"vm_id"`
	VMName       string `json:"vm_name"`
	Ticket       string `json:"ticket"`
	WebSocketURL string `json:"websocket_url"`
	Protocol     string `json:"protocol"` // "vnc" or "webmks"
	Host         string `json:"host"`
	Port         int    `json:"port"`
}

type DashboardSummaryResponse struct {
	TotalClusters   int       `json:"total_clusters"`
	TotalNodes      int       `json:"total_nodes"`
	TotalVMs        int       `json:"total_vms"`
	RunningVMs      int       `json:"running_vms"`
	StoppedVMs      int       `json:"stopped_vms"`
	TotalCPUCores   int       `json:"total_cpu_cores"`
	AllocatedCPU    int       `json:"allocated_cpu"`
	TotalRAMGB      int       `json:"total_ram_gb"`
	AllocatedRAMGB  int       `json:"allocated_ram_gb"`
	TotalStorageTB  float64   `json:"total_storage_tb"`
	AllocatedDiskGB int       `json:"allocated_disk_gb"`
	Clusters        []Cluster `json:"clusters"`
	RecentLogs      []VMActivityLog `json:"recent_logs"`
}

type MeteringTenantSummary struct {
	TenantID        uuid.UUID `json:"tenant_id"`
	TenantName      string    `json:"tenant_name"`
	ActiveVMCount   int       `json:"active_vm_count"`
	TotalVCPUHours  float64   `json:"total_vcpu_hours"`
	TotalRAMGBHours float64   `json:"total_ram_gb_hours"`
	TotalDiskGBDays float64   `json:"total_disk_gb_days"`
	EstimatedCost   float64   `json:"estimated_cost"` // Pre-wired estimation ready for billing plan
	PeriodStart     time.Time `json:"period_start"`
	PeriodEnd       time.Time `json:"period_end"`
}
