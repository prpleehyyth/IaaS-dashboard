# IaaS — Multi-Tenant Hybrid Cloud Controller (VMware & Proxmox)

Enterprise-grade multi-tenant private cloud management platform built to orchestrate **VMware vSphere** and **Proxmox VE** clusters with dynamic cluster registration, role-based access control, in-browser remote console, and billing telemetry.

---

## 🚀 Status Environment: VIRGIN DEVELOPMENT MODE

Sistem ini telah dikonfigurasi dalam mode **DEVELOPMENT (Virgin State)**:
* **0 Mock Clusters & 0 Mock Nodes** (Database bersih total, siap dihubungkan ke cluster Proxmox VE atau VMware vSphere asli via UI/API).
* **0 Dummy Virtual Machines** (Kosong total, siap di-provisioning).
* **0 Dummy Activity Logs & Metering Samples**.
* **1 Default Administrator Account** (`admin` / `admin123`) untuk login pertama kali.
* **1 Default Organization** (`Default Organization`).

---

## 👥 Kredensial Akun Default (Superadmin)

| Username | Password | Role | Scope Akses | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **ADMIN** | **Global Access** | **Cloud Administrator**: Hak penuh mendaftarkan cluster, menambah node fisik, membuat VM, manajemen user & kuota tenant. |

---

## 🌐 Dynamic Cluster & Node Management (Fitur Baru)

Pada mode development virgin ini, Anda dapat mendaftarkan cluster fisik Anda sendiri langsung dari UI:
1. **Connect Cluster**: Buka tab **"Clusters"**, klik tombol **"+ Connect Cluster"**, pilih tipe (`PROXMOX` atau `VMWARE`), masukkan URL endpoint (misal `https://192.168.1.100:8006`).
2. **Add Compute Node**: Di dalam kartu cluster yang telah didaftarkan, klik tombol **"+ Add Node"** untuk mendaftarkan host fisik (IP, CPU Cores, RAM GB, Disk GB).
3. **Reset to Virgin**: Terdapat tombol **"Reset to Virgin"** jika sewaktu-waktu Anda ingin mengosongkan kembali seluruh data dummy ke keadaan bersih.

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

