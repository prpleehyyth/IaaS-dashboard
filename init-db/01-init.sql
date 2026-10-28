-- PostgreSQL Database Schema for Multi-Tenant Private Cloud (VMware & Proxmox)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    max_cpu INT DEFAULT 64,
    max_ram_gb INT DEFAULT 256,
    max_storage_gb INT DEFAULT 2048,
    max_vms INT DEFAULT 50,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR')),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Clusters Table (VMware vCenter and Proxmox VE Clusters)
CREATE TABLE IF NOT EXISTS clusters (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('VMWARE', 'PROXMOX')),
    datacenter VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    auth_user VARCHAR(150) DEFAULT '',
    auth_secret TEXT DEFAULT '',
    insecure_ssl BOOLEAN DEFAULT true,
    version VARCHAR(50) DEFAULT '',
    status VARCHAR(20) DEFAULT 'ONLINE',
    total_cpu_cores INT DEFAULT 0,
    total_ram_gb INT DEFAULT 0,
    total_storage_tb NUMERIC(10, 2) DEFAULT 0,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Nodes Table (12 Nodes Total: 3 nodes per cluster)
CREATE TABLE IF NOT EXISTS nodes (
    id VARCHAR(50) PRIMARY KEY,
    cluster_id VARCHAR(50) REFERENCES clusters(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    status VARCHAR(20) DEFAULT 'READY',
    cpu_model VARCHAR(150),
    cpu_cores INT NOT NULL,
    cpu_usage_pct NUMERIC(5, 2) DEFAULT 0.0,
    ram_total_gb INT NOT NULL,
    ram_usage_gb NUMERIC(6, 2) DEFAULT 0.0,
    storage_total_gb INT NOT NULL,
    storage_usage_gb NUMERIC(8, 2) DEFAULT 0.0,
    uptime_seconds BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Virtual Machines Table
CREATE TABLE IF NOT EXISTS virtual_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    cluster_id VARCHAR(50) REFERENCES clusters(id),
    node_id VARCHAR(50) REFERENCES nodes(id),
    hypervisor_type VARCHAR(20) NOT NULL CHECK (hypervisor_type IN ('VMWARE', 'PROXMOX')),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'STOPPED', 'STARTING', 'STOPPING', 'ERROR')),
    cpu_cores INT NOT NULL DEFAULT 2,
    ram_mb INT NOT NULL DEFAULT 4096,
    disk_gb INT NOT NULL DEFAULT 50,
    ip_address VARCHAR(45) DEFAULT '',
    mac_address VARCHAR(45) DEFAULT '',
    os_type VARCHAR(50) DEFAULT 'Ubuntu',
    console_port INT DEFAULT 0,
    vmid INT DEFAULT 0, -- Proxmox VMID or VMware MoRef
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Audit & Activity Logs Table
CREATE TABLE IF NOT EXISTS vm_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    vm_id UUID REFERENCES virtual_machines(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- e.g. 'START_VM', 'STOP_VM', 'CREATE_VM', 'EDIT_VM', 'DELETE_VM', 'OPEN_CONSOLE'
    status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'FAILED', 'PENDING'
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Resource Metering Samples (Billing Ready)
CREATE TABLE IF NOT EXISTS resource_metering_samples (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    vm_id UUID REFERENCES virtual_machines(id) ON DELETE CASCADE,
    cpu_cores INT NOT NULL,
    ram_mb INT NOT NULL,
    disk_gb INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_vm_tenant ON virtual_machines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vm_cluster ON virtual_machines(cluster_id);
CREATE INDEX IF NOT EXISTS idx_vm_node ON virtual_machines(node_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vm_cluster_vmid ON virtual_machines(cluster_id, vmid) WHERE vmid > 0;
CREATE INDEX IF NOT EXISTS idx_activity_tenant ON vm_activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metering_tenant_time ON resource_metering_samples(tenant_id, recorded_at);

-- 8. User to VM Assignments (Granular per-user VM access control)
CREATE TABLE IF NOT EXISTS user_vm_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vm_id UUID REFERENCES virtual_machines(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, vm_id)
);

CREATE INDEX IF NOT EXISTS idx_user_vm_user ON user_vm_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vm_vm ON user_vm_assignments(vm_id);

-- =========================================================================
-- VIRGIN DEVELOPMENT SEED DATA (Clean State)
-- =========================================================================

-- 1. Default Tenant (Clean Organization)
INSERT INTO tenants (id, name, slug, description, max_cpu, max_ram_gb, max_storage_gb, max_vms)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Default Organization', 'default-org', 'Primary Development Tenant', 128, 512, 4096, 100)
ON CONFLICT (id) DO NOTHING;

-- 2. Default Administrator Account (admin / admin123)
INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, role, status)
VALUES 
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin', 'admin@cloud.local', '$2b$12$ycqPEuN3oSj8j23Fftg2z.1JauHr423u.AiF9ZUJ5Aaz1H42Fg8cS', 'Cloud Administrator', 'ADMIN', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- 9. Billing Rates Configuration
CREATE TABLE IF NOT EXISTS billing_rates (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    currency VARCHAR(10) DEFAULT 'IDR',
    cpu_rate_hourly NUMERIC(12, 2) DEFAULT 250.00,
    ram_rate_hourly NUMERIC(12, 2) DEFAULT 100.00,
    storage_rate_hourly NUMERIC(12, 2) DEFAULT 1.50,
    network_rate_hourly NUMERIC(12, 2) DEFAULT 50.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO billing_rates (id, currency, cpu_rate_hourly, ram_rate_hourly, storage_rate_hourly, network_rate_hourly)
VALUES ('default', 'IDR', 250.00, 100.00, 1.50, 50.00)
ON CONFLICT (id) DO NOTHING;

-- Clusters, Nodes, Virtual Machines, Activity Logs, and User Assignments are 100% VIRGIN (0 records).



