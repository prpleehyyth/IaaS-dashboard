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

## 👥 Hak Akses & Peran Pengguna (Role-Based Access Control)

| Peran (Role) | Hak Akses & Fitur | Keterangan |
| :--- | :--- | :--- |
| **Administrator (`ADMIN`)** | • Manajemen penuh siklus hidup VM (Create, Edit Specs, Power Action, Delete, Rebuild OS)<br>• Manajemen klaster hypervisor & node komputasi fisik<br>• Manajemen pengguna & penugasan akses VM granular<br>• Konfigurasi tarif katalog & melihat laporan billing / metering armada | Akses kontrol global untuk pengelola infrastruktur private cloud. |
| **VM Operator (`OPERATOR`)** | • Manajemen daya VM yang ditugaskan (Start, Stop, Restart)<br>• Reinstall / Rebuild sistem operasi VM yang ditugaskan<br>• Akses In-Browser Remote Console (Web Shell & NoVNC)<br>• Melihat riwayat audit aktivitas VM miliknya | Dibatasi khusus pada VM yang ditugaskan secara eksplisit oleh Admin. **Fitur dan laporan billing ditiadakan** untuk akun Operator. |

---

## 🔐 Keamanan & Proteksi Data (Security Hardening)

Platform ini telah melalui audit dan penguatan keamanan menyeluruh (*security hardening*):

1. **Enkripsi Kredensial At-Rest & Redaksi API (`CWE-312`, `CWE-200`)**:
   - Token Secret Proxmox dan Password Administrator vCenter dienkripsi menggunakan algoritma **AES-256-GCM** dengan prefix `enc:v1:` sebelum disimpan di database PostgreSQL.
   - Field `auth_secret` dikecualikan secara ketat dari seluruh serialisasi JSON (`json:"-"`), mencegah kebocoran kredensial ke frontend/browser.
2. **Mitigasi SSRF & Sanitasi Path Hypervisor (`CWE-918`, `CWE-20`)**:
   - Validasi ketat pada endpoint cluster yang memblokir IP metadata cloud (`169.254.0.0/16`, `metadata.google.internal`), interface loopback (`127.0.0.0/8`), hostname container internal (`redis`, `postgres`, `backend`), dan port sensitif.
   - Sanitasi ID node dan storage menggunakan `url.PathEscape` sebelum diinterpolasi ke path REST API hypervisor.
3. **CORS Terbatas & Perlindungan WebSocket Hijacking (`CWE-942`, `CWE-346`)**:
   - Kebijakan CORS memvalidasi origin menggunakan URL parser presisi terhadap allowlist domain sah, menolak serangan *substring domain spoofing*.
   - Tiket sesi remote console dikonsumsi secara atomik (*single-use*) menggunakan `GetDel` di Redis dan memverifikasi kecocokan UUID VM target.
4. **Proteksi Sesi JWT & Rate Limiting (`CWE-613`, `CWE-307`)**:
   - Penghapusan token autentikasi dari query string pada REST endpoint untuk mencegah kebocoran token di log HTTP.
   - Mekanisme revokasi sesi pengguna secara langsung di Redis saat akun pengguna dihapus.
   - Rate limiting pada endpoint login (maksimal 10 percobaan/menit per IP) dengan proteksi batas kapasitas memori.
5. **Hardening Container & Web Server (`CWE-250`, `CWE-693`)**:
   - Binary backend Go dijalankan sebagai user non-root (`appuser`, UID 10001) di dalam container Alpine.
   - Nginx menyematkan HTTP Security Headers standar: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy`.

---

## 🌐 Dynamic Cluster & Node Management

Pada mode development virgin ini, Anda dapat mendaftarkan cluster fisik Anda sendiri langsung dari antarmuka:
1. **Connect Cluster**: Buka tab **"Clusters"**, klik tombol **"+ Connect Cluster"**, pilih tipe (`PROXMOX` atau `VMWARE`), masukkan URL endpoint (misal `https://192.168.1.100:8006`).
2. **Add Compute Node**: Di dalam kartu cluster yang telah didaftarkan, klik tombol **"+ Add Node"** untuk mendaftarkan host fisik (IP, CPU Cores, RAM GB, Disk GB).
3. **Reset to Virgin**: Terdapat tombol **"Reset to Virgin"** jika sewaktu-waktu Anda ingin mengosongkan kembali seluruh data dummy ke keadaan bersih (dinonaktifkan secara otomatis pada mode `PRODUCTION`).

---

## 🔐 Manajemen User & Granular VM Assignment (Admin Only)

Sebagai Administrator (`admin`), Anda dapat:
1. **Melihat Daftar User**: Navigasi ke tab **"Users & VM Access"** di navbar atas.
2. **Tambah User Baru**: Klik tombol **"+ New User"**, masukkan username, full name, email, password, dan role (`ADMIN` atau `OPERATOR`).
3. **Assign Akses VM**:
   - Pada baris user target (misal `operator` atau user baru), klik tombol **"Assign VMs"**.
   - Modal interaktif akan menampilkan seluruh VM yang tersedia dengan checkbox.
   - Centang atau hapus centang VM yang diizinkan, lalu klik **"Save Assignments"**.
   - Perubahan langsung aktif seketika (*real-time enforcement* di database & backend API).

---

## 💰 Resource Metering & Multi-Tier Billing (Admin Only)

Modul penagihan dan telemetri sumber daya yang dirancang khusus untuk administrator:
- **Konfigurasi Tarif (Atur Tarif)**: Pengaturan tarif per jam (vCPU, RAM, Storage, Network) serta komponen bulanan (Virtualisasi, Manajemen, Bandwidth) berdasarkan tingkatan (Tier 1, Tier 2, Tier 3).
- **Laporan Billing Real-Time**: Rekapitulasi biaya komputasi armada per VM dengan perhitungan jam operasional bulanan (730 jam).
- **Ekspor Laporan**: Fitur ekspor rincian biaya VM ke format spreadsheet CSV.

---

## 🚀 Fitur Utama Lainnya

- **Hybrid Hypervisor Abstraction**: Antarmuka driver Go terpadu (`HypervisorDriver`) yang mengendalikan VMware vSphere (via REST API vCenter) dan Proxmox VE (via REST API Proxmox).
- **In-Browser Remote VM Console**:
  - WebSocket tunnel yang mem-proxy sesi VNC/guest console interaktif langsung di browser dengan kontrol Ctrl+Alt+Del, quick commands, dan status koneksi live.
- **Dukungan NoVNC**: Integrasi tautan monitor grafis langsung ke antarmuka NoVNC Proxmox VE untuk instalasi OS via ISO.

---

## ⚙️ Konfigurasi Lingkungan (.env)

Konfigurasi sistem dikendalikan via file `.env` (file `.env` dikecualikan dari Git demi keamanan):

```ini
# Pilihan Mode: DEVELOPMENT (lab testing), SIMULATOR (mock data), atau PRODUCTION (hardware fisik riil)
HYPERVISOR_MODE=DEVELOPMENT

# --- KUNCI KEAMANAN & ENKRIPSI ---
JWT_SECRET=super-secret-iaas-private-cloud-key-32chars-min
MASTER_ENCRYPTION_KEY=super-secret-iaas-private-cloud-key-32chars-min
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://pal.co.id

# --- DATABASE & CACHE ---
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=iaas_db
DATABASE_URL=postgres://postgres:postgres@postgres:5432/iaas_db?sslmode=disable
REDIS_ADDR=redis:6379
REDIS_PASSWORD=
PORT=8080

# --- KREDENSIAL PROXMOX VE ---
PROXMOX_ENDPOINT=https://192.168.10.100:8006
PROXMOX_TOKEN_ID=root@pam!iaas_controller
PROXMOX_TOKEN_SECRET=your-proxmox-token-uuid-here
PROXMOX_INSECURE_SSL=true

# --- KREDENSIAL VMWARE VCENTER ---
VCENTER_HOST=192.168.10.50
VCENTER_USER=administrator@vsphere.local
VCENTER_PASSWORD=YourVcenterPassword123!
VCENTER_INSECURE_SSL=true
VCENTER_DATACENTER=Datacenter-01
```

---

## 🛠️ Tech Stack

- **Backend**: Go 1.22 + Gin Framework + gorilla/websocket + sqlx + go-redis
- **Database**: PostgreSQL 16 + Redis 7
- **Frontend**: React 18 + Vite + Tailwind/Glassmorphism CSS + Lucide Icons + Nginx Alpine
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
