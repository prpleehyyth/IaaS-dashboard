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

-- 3. Clusters Table (3 VMware Clusters, 1 Proxmox Cluster)
CREATE TABLE IF NOT EXISTS clusters (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('VMWARE', 'PROXMOX')),
    datacenter VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ONLINE',
    total_cpu_cores INT DEFAULT 0,
    total_ram_gb INT DEFAULT 0,
    total_storage_tb NUMERIC(10, 2) DEFAULT 0,
    description TEXT,
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
    ip_address VARCHAR(45),
    mac_address VARCHAR(45),
    os_type VARCHAR(50) DEFAULT 'Ubuntu 22.04 LTS',
    console_port INT,
    vmid INT, -- Proxmox VMID or VMware MoRef
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
CREATE INDEX IF NOT EXISTS idx_activity_tenant ON vm_activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metering_tenant_time ON resource_metering_samples(tenant_id, recorded_at);

-- =========================================================================
-- SEED DATA
-- =========================================================================

-- 1. Default Tenant
INSERT INTO tenants (id, name, slug, description, max_cpu, max_ram_gb, max_storage_gb, max_vms)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Enterprise Cloud Org', 'enterprise-cloud', 'Primary Production Tenant', 128, 512, 4096, 100),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Alpha Development Team', 'alpha-dev', 'Secondary Tenant for Staging and Sandbox', 32, 128, 1024, 25)
ON CONFLICT (id) DO NOTHING;

-- 2. Default Users
-- Default Passwords: 
-- admin / admin123 (bcrypt hash: $2a$10$7Z25t0qZq7V9uU/mP6b1Ce60F4rL9B8h1fK9yAev6n3R270YlF6O.)
-- operator / operator123 (bcrypt hash: $2a$10$Wp839sLp6jVjWpB7hL/Fm.9F6EaU79s1O7A2H49p1nZz0U5Y6T6M2)
-- Note: In Go backend, we will support bcrypt and fallback to standard hash verification for simplicity.
INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, role, status)
VALUES 
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin', 'admin@cloud.local', '$2a$10$X7nC4KxO9l1s7E4Fz.o0teX/o.4p6KxT4QzE9F8E4p6KxT4QzE9F8', 'Cloud Administrator', 'ADMIN', 'ACTIVE'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'operator', 'operator@cloud.local', '$2a$10$X7nC4KxO9l1s7E4Fz.o0teX/o.4p6KxT4QzE9F8E4p6KxT4QzE9F8', 'VM Operator', 'OPERATOR', 'ACTIVE'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'devops-lead', 'devops@cloud.local', '$2a$10$X7nC4KxO9l1s7E4Fz.o0teX/o.4p6KxT4QzE9F8E4p6KxT4QzE9F8', 'DevOps Lead Engineer', 'OPERATOR', 'ACTIVE'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'db-admin', 'dba@cloud.local', '$2a$10$X7nC4KxO9l1s7E4Fz.o0teX/o.4p6KxT4QzE9F8E4p6KxT4QzE9F8', 'Database Administrator', 'OPERATOR', 'ACTIVE'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'frontend-dev', 'frontend@cloud.local', '$2a$10$X7nC4KxO9l1s7E4Fz.o0teX/o.4p6KxT4QzE9F8E4p6KxT4QzE9F8', 'Web & Edge Engineer', 'OPERATOR', 'ACTIVE'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'sandbox-user', 'sandbox@cloud.local', '$2a$10$X7nC4KxO9l1s7E4Fz.o0teX/o.4p6KxT4QzE9F8E4p6KxT4QzE9F8', 'Sandbox Tester', 'OPERATOR', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 3. Clusters (3 VMware Clusters + 1 Proxmox Cluster)
INSERT INTO clusters (id, name, type, datacenter, endpoint, status, total_cpu_cores, total_ram_gb, total_storage_tb, description)
VALUES 
    ('vmware-prod-01', 'VMware Cluster 01 (Compute)', 'VMWARE', 'DC-US-EAST', 'https://vcenter-01.infra.cloud.local/sdk', 'ONLINE', 144, 1152, 24.0, 'High-Performance VMware vSphere 8 Cluster for Core Workloads'),
    ('vmware-prod-02', 'VMware Cluster 02 (Database)', 'VMWARE', 'DC-US-EAST', 'https://vcenter-02.infra.cloud.local/sdk', 'ONLINE', 144, 1152, 36.0, 'Storage-Optimized VMware Cluster for DB & State Services'),
    ('vmware-prod-03', 'VMware Cluster 03 (DMZ & Web)', 'VMWARE', 'DC-US-WEST', 'https://vcenter-03.infra.cloud.local/sdk', 'ONLINE', 96, 768, 16.0, 'Edge & Public Facing Network Cluster'),
    ('proxmox-prod-01', 'Proxmox VE Cluster 01', 'PROXMOX', 'DC-EU-CENTRAL', 'https://pve-cluster.infra.cloud.local:8006', 'ONLINE', 96, 768, 18.0, 'High-Density Proxmox VE 8 Cluster with Ceph Storage')
ON CONFLICT (id) DO NOTHING;

-- 4. Nodes (12 Nodes Total: 3 nodes per cluster)
INSERT INTO nodes (id, cluster_id, name, ip_address, status, cpu_model, cpu_cores, cpu_usage_pct, ram_total_gb, ram_usage_gb, storage_total_gb, storage_usage_gb, uptime_seconds)
VALUES 
    -- VMware Cluster 01 Nodes
    ('esxi-01a', 'vmware-prod-01', 'esxi-node-01a.cloud.local', '10.10.1.11', 'READY', 'Intel Xeon Gold 6348 @ 2.60GHz', 48, 42.5, 384, 168.2, 8000, 3420.0, 1845200),
    ('esxi-01b', 'vmware-prod-01', 'esxi-node-01b.cloud.local', '10.10.1.12', 'READY', 'Intel Xeon Gold 6348 @ 2.60GHz', 48, 51.0, 384, 210.5, 8000, 4100.0, 1845180),
    ('esxi-01c', 'vmware-prod-01', 'esxi-node-01c.cloud.local', '10.10.1.13', 'READY', 'Intel Xeon Gold 6348 @ 2.60GHz', 48, 38.2, 384, 145.0, 8000, 2900.0, 1845150),

    -- VMware Cluster 02 Nodes
    ('esxi-02a', 'vmware-prod-02', 'esxi-node-02a.cloud.local', '10.10.2.11', 'READY', 'Intel Xeon Platinum 8358 @ 2.60GHz', 48, 58.7, 384, 245.8, 12000, 6800.0, 2419200),
    ('esxi-02b', 'vmware-prod-02', 'esxi-node-02b.cloud.local', '10.10.2.12', 'READY', 'Intel Xeon Platinum 8358 @ 2.60GHz', 48, 62.1, 384, 260.0, 12000, 7150.0, 2419190),
    ('esxi-02c', 'vmware-prod-02', 'esxi-node-02c.cloud.local', '10.10.2.13', 'READY', 'Intel Xeon Platinum 8358 @ 2.60GHz', 48, 49.3, 384, 198.4, 12000, 5400.0, 2419100),

    -- VMware Cluster 03 Nodes
    ('esxi-03a', 'vmware-prod-03', 'esxi-node-03a.cloud.local', '10.10.3.11', 'READY', 'AMD EPYC 7543 32-Core @ 2.80GHz', 32, 29.4, 256, 88.0, 5333, 1420.0, 950400),
    ('esxi-03b', 'vmware-prod-03', 'esxi-node-03b.cloud.local', '10.10.3.12', 'READY', 'AMD EPYC 7543 32-Core @ 2.80GHz', 32, 34.0, 256, 102.5, 5333, 1890.0, 950380),
    ('esxi-03c', 'vmware-prod-03', 'esxi-node-03c.cloud.local', '10.10.3.13', 'READY', 'AMD EPYC 7543 32-Core @ 2.80GHz', 32, 27.8, 256, 76.2, 5333, 1200.0, 950300),

    -- Proxmox Cluster 01 Nodes
    ('pve-node-01', 'proxmox-prod-01', 'pve-srv-01.cloud.local', '10.20.1.11', 'READY', 'AMD EPYC 7443P 24-Core @ 2.85GHz', 32, 45.1, 256, 134.0, 6000, 2800.0, 3110400),
    ('pve-node-02', 'proxmox-prod-01', 'pve-srv-02.cloud.local', '10.20.1.12', 'READY', 'AMD EPYC 7443P 24-Core @ 2.85GHz', 32, 41.6, 256, 122.8, 6000, 2450.0, 3110350),
    ('pve-node-03', 'proxmox-prod-01', 'pve-srv-03.cloud.local', '10.20.1.13', 'READY', 'AMD EPYC 7443P 24-Core @ 2.85GHz', 32, 36.9, 256, 110.5, 6000, 2100.0, 3110200)
ON CONFLICT (id) DO NOTHING;

-- 5. Virtual Machines Seed Data
INSERT INTO virtual_machines (id, tenant_id, cluster_id, node_id, hypervisor_type, name, status, cpu_cores, ram_mb, disk_gb, ip_address, mac_address, os_type, console_port, vmid, created_by)
VALUES 
    -- VMware Cluster 01 VMs
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-01', 'esxi-01a', 'VMWARE', 'k8s-master-01', 'RUNNING', 8, 16384, 120, '10.10.1.101', '00:50:56:a1:01:01', 'Ubuntu 22.04 LTS', 5900, 1001, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-01', 'esxi-01b', 'VMWARE', 'k8s-worker-01', 'RUNNING', 16, 32768, 250, '10.10.1.102', '00:50:56:a1:01:02', 'Ubuntu 22.04 LTS', 5901, 1002, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-01', 'esxi-01c', 'VMWARE', 'k8s-worker-02', 'RUNNING', 16, 32768, 250, '10.10.1.103', '00:50:56:a1:01:03', 'Ubuntu 22.04 LTS', 5902, 1003, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),

    -- VMware Cluster 02 VMs
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-02', 'esxi-02a', 'VMWARE', 'postgres-primary', 'RUNNING', 16, 65536, 500, '10.10.2.201', '00:50:56:a2:02:01', 'Debian 12 Bookworm', 5903, 2001, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-02', 'esxi-02b', 'VMWARE', 'postgres-replica', 'RUNNING', 16, 65536, 500, '10.10.2.202', '00:50:56:a2:02:02', 'Debian 12 Bookworm', 5904, 2002, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380006', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-02', 'esxi-02c', 'VMWARE', 'redis-sentinel-cluster', 'STOPPED', 4, 8192, 80, '10.10.2.203', '00:50:56:a2:02:03', 'Alpine Linux 3.19', 5905, 2003, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),

    -- VMware Cluster 03 VMs
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380007', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-03', 'esxi-03a', 'VMWARE', 'nginx-edge-proxy-01', 'RUNNING', 4, 8192, 60, '192.168.10.21', '00:50:56:a3:03:01', 'Rocky Linux 9', 5906, 3001, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380008', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'vmware-prod-03', 'esxi-03b', 'VMWARE', 'nginx-edge-proxy-02', 'RUNNING', 4, 8192, 60, '192.168.10.22', '00:50:56:a3:03:02', 'Rocky Linux 9', 5907, 3002, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),

    -- Proxmox Cluster 01 VMs
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380009', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'proxmox-prod-01', 'pve-node-01', 'PROXMOX', 'pve-analytics-engine', 'RUNNING', 12, 32768, 300, '10.20.1.150', 'BC:24:11:9A:01:01', 'Ubuntu 24.04 LTS', 5908, 101, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380010', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'proxmox-prod-01', 'pve-node-02', 'PROXMOX', 'pve-builder-runner-01', 'RUNNING', 8, 16384, 150, '10.20.1.151', 'BC:24:11:9A:01:02', 'Debian 12 Bookworm', 5909, 102, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380011', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'proxmox-prod-01', 'pve-node-03', 'PROXMOX', 'pve-monitoring-grafana', 'RUNNING', 4, 8192, 100, '10.20.1.152', 'BC:24:11:9A:01:03', 'Ubuntu 22.04 LTS', 5910, 103, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380012', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'proxmox-prod-01', 'pve-node-03', 'PROXMOX', 'pve-sandbox-dev', 'STOPPED', 2, 4096, 50, '10.20.1.153', 'BC:24:11:9A:01:04', 'Arch Linux', 5911, 104, 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01')
ON CONFLICT (id) DO NOTHING;

-- 6. Initial Activity Logs
INSERT INTO vm_activity_logs (tenant_id, vm_id, user_id, action, status, details)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CREATE_VM', 'SUCCESS', 'VM created on VMware cluster 01 (esxi-01a)'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380001', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'START_VM', 'SUCCESS', 'VM powered on successfully'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380009', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'CREATE_VM', 'SUCCESS', 'VM created on Proxmox cluster 01 (pve-node-01)'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380009', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'OPEN_CONSOLE', 'SUCCESS', 'Interactive web console session opened by operator');

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

-- Initial Assignments: Pre-configured VM assignments for all operator seed accounts
INSERT INTO user_vm_assignments (user_id, vm_id)
VALUES 
    -- 'operator': General multi-cluster operator (3 VMs)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380001'), -- k8s-master-01 (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380004'), -- postgres-primary (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380009'), -- pve-analytics-engine (Proxmox)

    -- 'devops-lead': Kubernetes & CI/CD Runner (4 VMs)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380001'), -- k8s-master-01 (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380002'), -- k8s-worker-01 (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380003'), -- k8s-worker-02 (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380010'), -- pve-builder-runner-01 (Proxmox)

    -- 'db-admin': Database Administrator (3 VMs)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380004'), -- postgres-primary (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380005'), -- postgres-replica (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380006'), -- redis-sentinel-cluster (VMware)

    -- 'frontend-dev': Web Edge & Monitoring (3 VMs)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380007'), -- nginx-edge-proxy-01 (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380008'), -- nginx-edge-proxy-02 (VMware)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380011'), -- pve-monitoring-grafana (Proxmox)

    -- 'sandbox-user': Sandbox Dev (1 VM)
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380012')  -- pve-sandbox-dev (Proxmox)
ON CONFLICT (user_id, vm_id) DO NOTHING;


