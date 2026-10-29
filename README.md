<div align="center">

# ☁️ Private Cloud IaaS
### Multi-Tenant Hybrid Cloud Controller & Fleet Orchestrator

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Go](https://img.shields.io/badge/Go-1.22-00ADD8?style=flat-square&logo=go&logoColor=white)](https://golang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM-10B981?style=flat-square&logo=shield&logoColor=white)](#-keamanan)
[![Status](https://img.shields.io/badge/Deployment-Virgin_State-8B5CF6?style=flat-square)](#3-cara-deploy)

<p align="center">
  <b>Solusi Manajemen Private Cloud Terpusat untuk Orkestrasi Klaster Proxmox VE & VMware vSphere</b>
</p>

---

</div>

## 1. 📖 About

**Private Cloud IaaS** adalah platform kontrol dan manajemen *private cloud hybrid* multi-tenant tingkat enterprise. Platform ini dirancang untuk mengorkestrasi, memantau, dan mengalokasikan sumber daya komputasi virtual machine (VM) pada infrastruktur **Proxmox VE** dan **VMware vSphere** secara aman, efisien, dan tersentralisasi dalam satu dashboard modern.

### 🌟 Fitur Utama:

* **🔄 Hybrid Hypervisor Orchestration**  
  Abstraksi kontrol terpadu melalui Go driver interface yang mampu berkomunikasi langsung dengan REST API Proxmox VE dan VMware vCenter.

* **🖥️ Dynamic Cluster & Node Discovery**  
  Pendaftaran klaster hypervisor secara dinamis melalui antarmuka web, pemindaian node fisik (*host*), sinkronisasi metrik kapasitas, dan penelusuran repositori file ISO otomatis.

* **👥 Granular Role-Based Access Control (RBAC)**  
  * **Administrator (`ADMIN`)**: Memiliki kendali menyeluruh atas pendaftaran cluster, host fisik, siklus VM (*create, resize specs, power, delete, rebuild*), kuota tenant, serta manajemen tarif dan laporan billing komputasi.
  * **VM Operator (`OPERATOR`)**: Diberikan akses terisolasi hanya untuk mengendalikan VM miliknya (Start, Stop, Restart, Rebuild OS, dan In-Browser Remote Console). Fitur billing disembunyikan secara khusus untuk operator demi privasi finansial.

* **⚡ Live Real-Time Telemetry & SVG Wave Diagrams**  
  Pemantauan sumber daya VM aktif secara langsung dengan **diagram radial gauge lingkaran** (CPU & RAM) serta **grafik gelombang interaktif real-time (*SVG live wave timeline chart*)** dengan interval sampling otomatis setiap 3.5 detik.

* **💻 In-Browser Remote Console**  
  WebSocket tunnel interaktif yang menghubungkan browser pengguna langsung ke sesi VNC/guest console VM, dilengkapi *quick command buttons* dan integrasi monitor grafis NoVNC.

* **🛡️ Enterprise Security Hardening**  
  Penyimpanan kredensial hypervisor terenkripsi penuh (**AES-256-GCM**), proteksi mitigasi SSRF & IP loopback/metadata, validasi ketat origin CORS & WebSocket, tiket konsol sekali pakai di Redis, serta container berjalan sebagai user *non-root*.

---

## 2. 🛠️ Tech Stack & Tools

<div align="center">

### 🧰 Technologies & Infrastructure

![GO](https://img.shields.io/badge/GO-1.22-00ADD8?style=for-the-badge&logo=go&logoColor=white&labelColor=23272d)
![GIN](https://img.shields.io/badge/GIN-WEB_FRAMEWORK-008ECF?style=for-the-badge&logo=go&logoColor=white&labelColor=23272d)
![REACT](https://img.shields.io/badge/REACT-18.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB&labelColor=23272d)
![VITE](https://img.shields.io/badge/VITE-BUILD_TOOL-646CFF?style=for-the-badge&logo=vite&logoColor=white&labelColor=23272d)

![POSTGRESQL](https://img.shields.io/badge/POSTGRESQL-DATABASE-4169E1?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=23272d)
![REDIS](https://img.shields.io/badge/REDIS-CACHE_%26_LOCK-DC382D?style=for-the-badge&logo=redis&logoColor=white&labelColor=23272d)
![DOCKER](https://img.shields.io/badge/DOCKER-CONTAINER-2496ED?style=for-the-badge&logo=docker&logoColor=white&labelColor=23272d)
![NGINX](https://img.shields.io/badge/NGINX-REVERSE_PROXY-009639?style=for-the-badge&logo=nginx&logoColor=white&labelColor=23272d)

![PROXMOX](https://img.shields.io/badge/PROXMOX-VE_8_KVM-E57000?style=for-the-badge&logo=proxmox&logoColor=white&labelColor=23272d)
![VMWARE](https://img.shields.io/badge/VMWARE-VSPHERE_8-607078?style=for-the-badge&logo=vmware&logoColor=white&labelColor=23272d)
![ALPINE](https://img.shields.io/badge/ALPINE-LINUX_SECURITY-0D597F?style=for-the-badge&logo=alpinelinux&logoColor=white&labelColor=23272d)

<br/>

</div>

### 🧩 Rincian Komponen Arsitektur:

| Kategori | Teknologi | Peran & Deskripsi |
| :--- | :--- | :--- |
| **Backend Core** | `Go 1.22` • `Gin Gonic` | REST API berkinerja tinggi, concurrent hypervisor workers, dan rate-limited endpoints |
| **Console Tunnel** | `Gorilla WebSocket` | Terowongan bidirectional real-time untuk stream terminal konsol VNC & WebMKS |
| **Frontend UI** | `React 18` • `Vite` • `Lucide` | Single Page Application (SPA) responsif bertema Glassmorphism & custom SVG charts |
| **Primary Database** | `PostgreSQL 16` | Penyimpanan relasional terstruktur untuk cluster, compute nodes, VM specs, users, dan audit log |
| **Cache & State** | `Redis 7` | Distributed lock operasi daya VM, manajemen tiket sesi VNC *single-use*, dan revokasi JWT |
| **Web Server** | `Nginx Alpine` | Reverse proxy, static asset delivery, WebSocket upgrade forwarding, dan HTTP security headers |
| **Hypervisors** | `Proxmox VE` • `VMware vSphere` | Virtualization cluster endpoints yang diorkestrasi langsung via API resmi |
| **DevOps** | `Docker` • `Docker Compose` | Lingkungan deployment mandiri (*containerized*) dengan non-root user execution (`appuser`) |

---

## 3. 🚀 Cara Deploy

Aplikasi telah sepenuhnya dikonfigurasi menggunakan **Docker Compose**, sehingga proses deployment dapat dilakukan dalam hitungan detik.

### 📋 Prasyarat Sistem:
- **Docker Engine** (versi 24.0+)
- **Docker Compose** (versi v2.20+)
- Port `3000`, `8080`, `5432`, dan `6379` tersedia pada host.

---

### 📦 Panduan Langkah Demi Langkah:

#### 1️⃣ Clone Repositori
```bash
git clone https://github.com/saiful/IaaS-dashboard.git
cd IaaS-dashboard
```

#### 2️⃣ Konfigurasi Variabel Lingkungan (`.env`)
Salin template konfigurasi dan sesuaikan kredensial keamanan:
```bash
cp .env.example .env
```

> **Contoh isi file `.env`:**
```ini
# Mode Operasi: DEVELOPMENT (lab test), SIMULATOR (mock data), atau PRODUCTION (hardware fisik)
HYPERVISOR_MODE=DEVELOPMENT

# Kunci Keamanan & Enkripsi AES-256 (Ganti dengan string rahasia >= 32 karakter)
JWT_SECRET=super-secret-iaas-private-cloud-key-32chars-min
MASTER_ENCRYPTION_KEY=super-secret-iaas-private-cloud-key-32chars-min
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Basis Data & Cache
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=iaas_db
DATABASE_URL=postgres://postgres:postgres@postgres:5432/iaas_db?sslmode=disable
REDIS_ADDR=redis:6379
REDIS_PASSWORD=
PORT=8080

# Kredensial Proxmox VE (Dapat juga dikonfigurasi langsung via UI)
PROXMOX_ENDPOINT=https://192.168.10.100:8006
PROXMOX_TOKEN_ID=root@pam!iaas_controller
PROXMOX_TOKEN_SECRET=your-proxmox-token-secret-here
PROXMOX_INSECURE_SSL=true

# Kredensial VMware vCenter (Dapat juga dikonfigurasi langsung via UI)
VCENTER_HOST=192.168.10.50
VCENTER_USER=administrator@vsphere.local
VCENTER_PASSWORD=YourVcenterPassword123!
VCENTER_INSECURE_SSL=true
VCENTER_DATACENTER=Datacenter-01
```

#### 3️⃣ Jalankan Seluruh Layanan dengan Satu Perintah
Eksekusi perintah berikut untuk membangun (*build*) image dan menjalankan keempat kontainer secara otomatis:
```bash
docker compose up --build -d
```

#### 4️⃣ Periksa Status Kontainer
Pastikan seluruh container telah berjalan normal (*healthy*):
```bash
docker compose ps
```

---

### 🌐 Portal Layanan & Kredensial Default

| Layanan | Endpoint / URL | Keterangan |
| :--- | :--- | :--- |
| **Frontend Web Dashboard** | [http://localhost:3000](http://localhost:3000) | Antarmuka pengguna dashboard utama |
| **Backend REST API** | [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health) | API health check & gateway |
| **PostgreSQL Database** | `localhost:5432` | User: `postgres`, DB: `iaas_db` |
| **Redis Cache & Lock** | `localhost:6379` | Sesi token & distributed lock |

#### 🔑 Akun Superadmin Awal:
* **Username**: `admin`
* **Password**: `admin123`
*(Disarankan untuk segera mengganti password default melalui menu **Users & VM Access** setelah berhasil masuk)*.

---

### ⚙️ Perintah Operasional Kontainer:

```bash
# Memantau log aplikasi secara real-time
docker compose logs -f

# Merestart layanan backend dan frontend
docker compose restart backend frontend

# Menghentikan seluruh container
docker compose down
```

---

<div align="center">

<p align="center">
  <sub>Built for Enterprise Private Cloud & Multi-Tenant Infrastructure Management</sub>
</p>

</div>
