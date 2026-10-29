# CloudForge IaaS — Multi-Tenant Hybrid Cloud Controller

<div align="center">

Enterprise Private Cloud Controller & Fleet Virtual Machine Orchestrator for **Proxmox VE** and **VMware vSphere**

</div>

---

## 1. About

**CloudForge IaaS** adalah platform manajemen dan orkestrasi *private cloud hybrid* multi-tenant yang memungkinkan pengelolaan terpusat klaster **Proxmox VE** dan **VMware vSphere** dalam satu panel kontrol modern dan terintegrasi.

### ✨ Fitur Unggulan:
- **Unified Hybrid Orchestration**: Mengendalikan klaster Proxmox VE dan VMware vCenter melalui abstraksi driver terpadu (*unified Go driver interface*).
- **Dynamic Cluster & Node Fleet**: Pendaftaran klaster hypervisor secara dinamis, penemuan host (*node discovery*), dan sinkronisasi kapasitas sumber daya secara otomatis.
- **Granular Role-Based Access Control (RBAC)**:
  - **Administrator (`ADMIN`)**: Manajemen penuh siklus VM, pendaftaran klaster & host fisik, manajemen tenant & kuota, serta pengaturan tarif dan laporan billing komputasi.
  - **VM Operator (`OPERATOR`)**: Dibatasi hanya untuk mengendalikan VM yang ditugaskan (Start, Stop, Restart, Rebuild OS, dan Remote Console).
- **In-Browser Remote VM Console**: Akses terminal interaktif langsung di browser via WebSocket tunnel (VNC & WebMKS) serta integrasi monitor grafis NoVNC.
- **Live Real-Time Telemetry & Diagrams**: Monitoring metrik vCPU, Memory RAM, Storage, dan Network I/O dengan visualisasi **diagram radial donut** dan **grafik gelombang interaktif (SVG wave area chart)** yang diperbarui secara *real-time*.
- **Enterprise-Grade Security Hardening**: Kredensial klaster dienkripsi menggunakan **AES-256-GCM**, proteksi ketat mitigasi SSRF, sanitasi path hypervisor, validasi CORS & WebSocket Origin, single-use console ticket di Redis, serta container berjalan sebagai user non-root.

---

## 2. Tech Stack & Tools

<div align="center">

![Go](https://img.shields.io/badge/Go-1.22-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![Gin](https://img.shields.io/badge/Gin-Framework-008ECF?style=for-the-badge&logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Container-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-Reverse_Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Proxmox](https://img.shields.io/badge/Proxmox-VE_8-E57000?style=for-the-badge&logo=proxmox&logoColor=white)
![VMware](https://img.shields.io/badge/VMware-vSphere-607078?style=for-the-badge&logo=vmware&logoColor=white)

</div>

### Komponen Arsitektur:
| Lapisan (Layer) | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Backend API** | Go 1.22, Gin Gonic, Gorilla WebSocket, SQLX | High-performance async API server & WebSocket tunnel |
| **Frontend Web** | React 18, Vite, Lucide Icons | Responsive Glassmorphism Dashboard & SVG Live Telemetry Charts |
| **Database** | PostgreSQL 16 (Alpine) | Relational storage untuk tenant, users, cluster, VM, dan audit logs |
| **Cache & Lock** | Redis 7 (Alpine) | Distributed locking aksi VM, sesi tiket konsol, dan revokasi JWT |
| **Reverse Proxy** | Nginx Alpine | Static SPA routing, reverse proxy API, dan HTTP security headers |
| **Hypervisor Integrasi** | Proxmox VE REST API, VMware vCenter REST API | Konektor orkestrasi infrastruktur virtualisasi |
| **Orchestration** | Docker & Docker Compose | Multi-container automated orchestration & non-root runner |

---

## 3. Cara Deploy

Aplikasi dikemas secara penuh menggunakan Docker Compose, sehingga dapat dijalankan dengan mudah pada server Linux lokal maupun cloud.

### 📋 Prasyarat:
- **Docker Engine** (versi 24.0 atau lebih baru)
- **Docker Compose** (versi v2.20 atau lebih baru)

---

### 🛠️ Langkah-Langkah Deployment:

#### 1. Clone Repositori
```bash
git clone https://github.com/saiful/IaaS-dashboard.git
cd IaaS-dashboard
```

#### 2. Konfigurasi File Environment (`.env`)
Salin file template contoh atau sesuaikan kredensial pada file `.env`:
```bash
cp .env.example .env
```
Contoh konfigurasi penting pada `.env`:
```ini
# Mode: DEVELOPMENT (lab testing), SIMULATOR (mock), atau PRODUCTION (hardware fisik)
HYPERVISOR_MODE=DEVELOPMENT

# Kunci Keamanan & Enkripsi AES-256
JWT_SECRET=super-secret-iaas-private-cloud-key-32chars-min
MASTER_ENCRYPTION_KEY=super-secret-iaas-private-cloud-key-32chars-min
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Database & Cache
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=iaas_db
DATABASE_URL=postgres://postgres:postgres@postgres:5432/iaas_db?sslmode=disable
REDIS_ADDR=redis:6379
REDIS_PASSWORD=
PORT=8080

# Kredensial Proxmox VE (Opsional, dapat juga didaftarkan via UI)
PROXMOX_ENDPOINT=https://192.168.10.100:8006
PROXMOX_TOKEN_ID=root@pam!iaas_controller
PROXMOX_TOKEN_SECRET=your-proxmox-token-secret-here
PROXMOX_INSECURE_SSL=true

# Kredensial VMware vCenter (Opsional, dapat juga didaftarkan via UI)
VCENTER_HOST=192.168.10.50
VCENTER_USER=administrator@vsphere.local
VCENTER_PASSWORD=YourVcenterPassword123!
VCENTER_INSECURE_SSL=true
VCENTER_DATACENTER=Datacenter-01
```

#### 3. Jalankan Kontainer Menggunakan Docker Compose
Bangun image dan jalankan seluruh service di latar belakang (*detached mode*):
```bash
docker compose up --build -d
```

#### 4. Verifikasi Status Layanan
Pastikan keempat kontainer berjalan normal dan berstatus *healthy*:
```bash
docker compose ps
```

---

### 🌐 Akses Layanan & Akun Default:

| Layanan | URL / Endpoint | Keterangan |
| :--- | :--- | :--- |
| **Frontend Web Panel** | [http://localhost:3000](http://localhost:3000) | Antarmuka dashboard utama |
| **Backend API Health** | [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health) | REST API health check endpoint |
| **PostgreSQL Database** | `localhost:5432` | User: `postgres`, DB: `iaas_db` |
| **Redis Cache** | `localhost:6379` | Key-value store & lock service |

#### 🔑 Kredensial Login Default (Superadmin):
- **Username**: `admin`
- **Password**: `admin123`
*(Disarankan untuk segera mengubah password setelah login pertama kali di menu **Users & VM Access**)*.

---

### 🛑 Perintah Manajemen Kontainer:

- **Melihat Log Aplikasi Secara Live**:
  ```bash
  docker compose logs -f
  ```
- **Restart Seluruh Layanan**:
  ```bash
  docker compose restart
  ```
- **Menghentikan Layanan**:
  ```bash
  docker compose down
  ```
