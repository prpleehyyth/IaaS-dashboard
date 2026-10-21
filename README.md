# CloudForge IaaS — Multi-Tenant Hybrid Cloud Controller (VMware & Proxmox)

Enterprise-grade multi-tenant private cloud management platform built to orchestrate **3 VMware vSphere clusters (9 nodes)** and **1 Proxmox VE cluster (3 nodes)** with role-based access control, granular user-to-VM assignment, in-browser remote console, and billing telemetry.

---

## 👥 User Seeder & Kredensial Akun (Default Accounts)

Sistem telah dilengkapi dengan **User Seeder** otomatis di database PostgreSQL (`init-db/01-init.sql`). Setiap akun operator telah di-assign ke VM tertentu untuk menguji **isolasi akses multi-tenant & granular per-user**.

| Username | Password | Role | Scope Akses / Assigned VMs | Deskripsi & Hak Akses |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **ADMIN** | **Semua 12 VMs** (Global Access) | **Cloud Administrator**: Hak penuh create, edit specs, start, stop, delete VM, manajemen user, assign akses VM, dan setting kuota tenant. |
| `operator` | `operator123` | **OPERATOR** | **3 VMs**:<br>• `k8s-master-01` (VMware)<br>• `postgres-primary` (VMware)<br>• `pve-analytics-engine` (Proxmox) | **General Operator**: Multi-cluster operator umum. Hanya dapat start, stop, dan buka remote web console pada VM yang di-assign. |
| `devops-lead` | `devops123` | **OPERATOR** | **4 VMs**:<br>• `k8s-master-01` (VMware)<br>• `k8s-worker-01` (VMware)<br>• `k8s-worker-02` (VMware)<br>• `pve-builder-runner-01` (Proxmox) | **DevOps & CI/CD Lead**: Dikhususkan untuk mengelola cluster Kubernetes dan runner build automation. |
| `db-admin` | `dbadmin123` | **OPERATOR** | **3 VMs**:<br>• `postgres-primary` (VMware)<br>• `postgres-replica` (VMware)<br>• `redis-sentinel-cluster` (VMware) | **Database Administrator**: Dikhususkan untuk stack database stateful (PostgreSQL High Availability & Redis Sentinel). |
| `frontend-dev` | `frontend123` | **OPERATOR** | **3 VMs**:<br>• `nginx-edge-proxy-01` (VMware)<br>• `nginx-edge-proxy-02` (VMware)<br>• `pve-monitoring-grafana` (Proxmox) | **Web & Edge Engineer**: Akses ke reverse proxy Nginx dan server monitoring Grafana. |
| `sandbox-user` | `sandbox123` | **OPERATOR** | **1 VM**:<br>• `pve-sandbox-dev` (Proxmox) | **Sandbox Tester**: Akses minimal terisolasi hanya ke 1 VM testing pada Proxmox VE. |

> 💡 **Cara Menguji Isolasi Akses:**
> 1. Buka [http://localhost:3000](http://localhost:3000).
> 2. Login sebagai `operator` (Password: `operator123`) -> Perhatikan hanya **3 VM** yang tampil di dashboard.
> 3. Logout, lalu login sebagai `devops-lead` (Password: `devops123`) -> Perhatikan hanya **4 VM Kubernetes & CI/CD** yang tampil.
> 4. Logout, lalu login sebagai `sandbox-user` (Password: `sandbox123`) -> Perhatikan hanya **1 VM Sandbox** yang tampil.
> 5. Login kembali sebagai `admin` (Password: `admin123`) -> Seluruh **12 VM** tampil, tombol **"New Virtual Machine"** aktif, dan tab **"Users & VM Access"** terbuka.

---

## 🔐 Manajemen User & Granular VM Assignment (Admin Feature)

Sebagai Administrator (`admin`), Anda dapat:
1. **Melihat Daftar User**: Navigasi ke tab **"Users & VM Access"** di navbar atas.
2. **Tambah User Baru**: Klik tombol **"+ New User"**, masukkan username, full name, email, password, dan role (`ADMIN` atau `OPERATOR`).
3. **Assign Akses VM**:
   - Pada baris user target (misal `operator` atau user baru), klik tombol **"Assign VMs"**.
   - Modal interaktif akan menampilkan seluruh VM yang tersedia dengan checkbox.
   - Centang atau hapus centang VM yang diizinkan, lalu klik **"Save Assignments"**.
   - Perubahan langsung aktif seketika (real-time enforcement di database & backend API).

---

## 🚀 Key Features

- **Hybrid Hypervisor Abstraction**: Unified Go driver interface (`HypervisorDriver`) yang mengendalikan VMware vSphere (via `govmomi`) dan Proxmox VE (via REST API).
- **Fleet Scale (12 Physical Nodes / 4 Clusters)**:
  - `vmware-prod-01`: Compute Cluster (3 nodes: `esxi-01a`, `esxi-01b`, `esxi-01c`)
  - `vmware-prod-02`: Database Cluster (3 nodes: `esxi-02a`, `esxi-02b`, `esxi-02c`)
  - `vmware-prod-03`: DMZ & Web Cluster (3 nodes: `esxi-03a`, `esxi-03b`, `esxi-03c`)
  - `proxmox-prod-01`: Proxmox VE 8 Cluster (3 nodes: `pve-node-01`, `pve-node-02`, `pve-node-03`)
- **Role-Based Access Control (RBAC)**:
  - **Administrator (`ADMIN`)**: Siklus penuh VM (create, edit vCPU/RAM/Disk, start, stop, delete VM), manajemen kuota tenant, manajemen user & penugasan VM.
  - **VM Operator (`OPERATOR`)**: Dibatasi hanya pada VM yang ditugaskan (Start, Stop, dan In-Browser Remote Console).
- **In-Browser Remote VM Console**:
  - WebSocket tunnel yang mem-proxy sesi VNC/guest console interaktif langsung di browser dengan kontrol Ctrl+Alt+Del dan status koneksi live.
- **Resource Metering & Billing Readiness**:
  - Background telemetry loop yang mencatat sampel vCPU cores, RAM MB, dan disk GB per tenant ke tabel `resource_metering_samples`.
  - Siap diintegrasikan dengan modul Billing Plan.

---

## ⚙️ Hypervisor Mode & Kredensial (.env)

Konfigurasi koneksi cluster dikendalikan via file `.env`:

```ini
# Pilihan Mode: SIMULATOR (mock data untuk dev/testing) atau PRODUCTION (hardware riil)
HYPERVISOR_MODE=SIMULATOR

# --- PROXMOX VE 8 CREDENTIALS ---
PROXMOX_ENDPOINT=https://pve-cluster.infra.cloud.local:8006
PROXMOX_NODE=pve-node-01
PROXMOX_TOKEN_ID=root@pam!iaas_token
PROXMOX_TOKEN_SECRET=your-proxmox-token-uuid-here
PROXMOX_VERIFY_SSL=false

# --- VMWARE VSPHERE CREDENTIALS ---
VMWARE_VCENTER_URL=https://vcenter-01.infra.cloud.local/sdk
VMWARE_USERNAME=administrator@vsphere.local
VMWARE_PASSWORD=YourSecureVcenterPasswordHere!
VMWARE_INSECURE_SSL=true
```

---

## 🛠️ Tech Stack

- **Backend**: Go 1.22 + Gin Framework
- **Database**: PostgreSQL 16 (dengan seeder 4 cluster, 12 node, 12 VM, dan 6 user ter-assign)
- **Cache & Distributed Locks**: Redis 7
- **Frontend**: React 18 + Vite + Tailwind/Glassmorphism CSS + Lucide Icons + Nginx
- **Orchestration**: Docker Compose

---

## 🏃 Menjalankan Aplikasi

Jalankan seluruh platform (Frontend, Backend, PostgreSQL, Redis) dengan satu perintah:

```bash
docker compose up --build -d
```

### URL Layanan:
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API Health Check**: [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)
- **PostgreSQL**: `localhost:5432` (`postgres` / `postgres` - Database: `iaas_db`)
- **Redis**: `localhost:6379`

