/**
 * KATALOG HARGA SEWA SERVER IAAS / VM KORPORASI — SISTEM TIER 1, TIER 2, & TIER 3
 * Sumber: Dokumen Resmi Rencana Harga Sewa Server IaaS (Acuan 730 Jam/Bulan)
 */

export const HOURS_PER_MONTH = 730;

export const COMPUTE_STORAGE_CATALOG = [
  {
    code: 'CMP-CPU',
    name: 'vCPU (Processor Core)',
    unit: 'per 1 Core',
    spec: 'Enterprise Xeon / EPYC Dedicated Thread (vCPU)',
    tier1: { hourly: 68.49, monthly: 50000 },
    tier2: { hourly: 100.00, monthly: 73000 },
    tier3: { hourly: 136.99, monthly: 100000 },
  },
  {
    code: 'CMP-RAM',
    name: 'Memory (vRAM)',
    unit: 'per 1 GB',
    spec: 'DDR4 / DDR5 ECC Registered Server Memory',
    tier1: { hourly: 34.25, monthly: 25000 },
    tier2: { hourly: 50.00, monthly: 36500 },
    tier3: { hourly: 68.49, monthly: 50000 },
  },
  {
    code: 'STR-HSATA',
    name: 'HDD SATA (7.2K RPM)',
    unit: 'per 1 GB',
    spec: 'HDD SATA 6Gbps RAID 6 — File Server, Archive, Cold Data',
    tier1: { hourly: 0.55, monthly: 400 },
    tier2: { hourly: 0.68, monthly: 500 },
    tier3: { hourly: 0.89, monthly: 650 },
  },
  {
    code: 'STR-HSAS',
    name: 'HDD SAS (10K/15K RPM)',
    unit: 'per 1 GB',
    spec: 'HDD SAS 12Gbps RAID 10 — OS VM Standar & App Internal',
    tier1: { hourly: 0.89, monthly: 650 },
    tier2: { hourly: 1.10, monthly: 800 },
    tier3: { hourly: 1.37, monthly: 1000 },
  },
  {
    code: 'STR-SSATA',
    name: 'SSD SATA Enterprise (6Gbps)',
    unit: 'per 1 GB',
    spec: 'SSD SATA 6Gbps RAID 5/6 — Web/App Server & DB Menengah',
    tier1: { hourly: 1.30, monthly: 950 },
    tier2: { hourly: 1.51, monthly: 1100 },
    tier3: { hourly: 1.85, monthly: 1350 },
  },
  {
    code: 'STR-SSAS',
    name: 'SSD SAS Enterprise (12Gbps)',
    unit: 'per 1 GB',
    spec: 'SSD SAS 12Gbps Dual-Port RAID 10 — Production DB & ERP',
    tier1: { hourly: 1.64, monthly: 1200 },
    tier2: { hourly: 1.92, monthly: 1400 },
    tier3: { hourly: 2.40, monthly: 1750 },
  },
  {
    code: 'OTC-STP',
    name: 'Setup, Provisioning & Hardening',
    unit: 'per 1 VM',
    spec: 'Instalasi awal OS RedHat/Linux, konfigurasi VLAN/Firewall & hardening dasar',
    scheme: 'Sekali Bayar (OTC)',
    note: 'Ditagihkan 1x di bulan pertama saja',
    tier1: { hourly: 0, monthly: 150000, isOTC: true },
    tier2: { hourly: 0, monthly: 250000, isOTC: true },
    tier3: { hourly: 0, monthly: 350000, isOTC: true },
  },
];

export const SERVICES_LICENSE_CATALOG = [
  {
    code: 'VRT-CST',
    name: 'Cost Virtualization (Hypervisor)',
    unit: 'per 1 Core',
    coverage: 'Biaya lisensi & manajemen cluster Hypervisor / Virtualization Layer (dihitung per vCPU)',
    note: 'Otomatis mengikuti jumlah Core vCPU',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 10000, hourly: 13.70 },
    tier2: { monthly: 15000, hourly: 20.55 },
    tier3: { monthly: 25000, hourly: 34.25 },
  },
  {
    code: 'MAN-CST',
    name: 'Man Cost (Engineer & Operations)',
    unit: 'per 1 VM',
    coverage: 'Biaya personel IT / SysAdmin, operasional 24/7, monitoring & troubleshooting rutin',
    note: 'Menggantikan biaya perawatan/maintenance',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 100000, hourly: 136.99 },
    tier2: { monthly: 150000, hourly: 205.48 },
    tier3: { monthly: 250000, hourly: 342.47 },
  },
  {
    code: 'LIC-RHEL',
    name: 'Lisensi OS RedHat (RHEL Server)',
    unit: 'per 2 Core',
    coverage: 'Red Hat Enterprise Linux Server Subscription (1 Sub mencakup hingga 2 vCPU)',
    note: 'Berlaku jika memilih OS RedHat (RHEL)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 160000, hourly: 219.18 },
    tier2: { monthly: 185000, hourly: 253.42 },
    tier3: { monthly: 225000, hourly: 308.22 },
  },
  {
    code: 'LIC-FREE',
    name: 'Non-RedHat / Community Linux',
    unit: 'per 1 VM',
    coverage: 'Ubuntu Server, Debian, Rocky Linux, AlmaLinux (Tanpa biaya subskripsi RHEL)',
    note: 'Gratis (Rp 0)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 0, hourly: 0 },
    tier2: { monthly: 0, hourly: 0 },
    tier3: { monthly: 0, hourly: 0 },
  },
  {
    code: 'BCK-PBS-WARM',
    name: 'Add-On Proxmox Backup Server (PBS) — Warm Backup',
    unit: 'per 1 VM',
    coverage: 'Live Online Snapshot (Zero Downtime Dirty-Bitmap Incremental, Deduplikasi & Zstd Encryption ke PBS)',
    note: 'Khusus Hypervisor Proxmox VE (Mode: WARM / Live Snapshot)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 50000, hourly: 68.49 },
    tier2: { monthly: 75000, hourly: 102.74 },
    tier3: { monthly: 100000, hourly: 136.99 },
  },
  {
    code: 'BCK-PBS-COLD',
    name: 'Add-On Proxmox Backup Server (PBS) — Cold Backup',
    unit: 'per 1 VM',
    coverage: 'Consistent Offline Backup (Stop-Mode Full Block Consistency & Long-Term Archive ke PBS)',
    note: 'Khusus Hypervisor Proxmox VE (Mode: COLD / Offline Archive)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 30000, hourly: 41.10 },
    tier2: { monthly: 45000, hourly: 61.64 },
    tier3: { monthly: 65000, hourly: 89.04 },
  },
  {
    code: 'BCK-NETAPP-WARM',
    name: 'Add-On VMware NetApp SnapCenter — Warm Backup',
    unit: 'per 1 VM',
    coverage: 'NetApp ONTAP Live Crash/App-Consistent Snapshot & SnapMirror Replication (Zero Downtime)',
    note: 'Khusus Hypervisor VMware vSphere (Mode: WARM / Live Snapshot)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 150000, hourly: 205.48 },
    tier2: { monthly: 200000, hourly: 273.97 },
    tier3: { monthly: 250000, hourly: 342.47 },
  },
  {
    code: 'BCK-NETAPP-COLD',
    name: 'Add-On VMware NetApp ONTAP — Cold Backup',
    unit: 'per 1 VM',
    coverage: 'NetApp ONTAP Quiesced/Offline Volume Snapshot & SnapVault Long-Term Cold Archive',
    note: 'Khusus Hypervisor VMware vSphere (Mode: COLD / Offline Archive)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 95000, hourly: 130.14 },
    tier2: { monthly: 130000, hourly: 178.08 },
    tier3: { monthly: 175000, hourly: 239.73 },
  },
  {
    code: 'BCK-VEEAM-WARM',
    name: 'Add-On VMware Veeam Backup & Replication — Warm Backup',
    unit: 'per 1 VM',
    coverage: 'Veeam Universal License (VUL) — vSphere CBT Live Snapshot, Instant VM Recovery & Application-Aware Processing',
    note: 'Khusus Hypervisor VMware vSphere (Mode: WARM / Live Snapshot)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 150000, hourly: 205.48 },
    tier2: { monthly: 200000, hourly: 273.97 },
    tier3: { monthly: 250000, hourly: 342.47 },
  },
  {
    code: 'BCK-VEEAM-COLD',
    name: 'Add-On VMware Veeam Backup & Replication — Cold Backup',
    unit: 'per 1 VM',
    coverage: 'Veeam Universal License (VUL) — Consistent Offline Backup Copy & Scale-Out Archive Repository',
    note: 'Khusus Hypervisor VMware vSphere (Mode: COLD / Offline Archive)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 95000, hourly: 130.14 },
    tier2: { monthly: 130000, hourly: 178.08 },
    tier3: { monthly: 175000, hourly: 239.73 },
  },
  {
    code: 'BCK-STR-WARM',
    name: 'Repository Storage Backup (Warm / Active Tier)',
    unit: 'per 1 GB',
    coverage: 'Kuota ruang simpan snapshot harian cepat pada datastore PBS / NetApp ONTAP aktif',
    note: 'Dihitung per GB kuota backup (Mode Warm)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 300, hourly: 0.41 },
    tier2: { monthly: 400, hourly: 0.55 },
    tier3: { monthly: 500, hourly: 0.68 },
  },
  {
    code: 'BCK-STR-COLD',
    name: 'Repository Storage Backup (Cold / Archive Tier)',
    unit: 'per 1 GB',
    coverage: 'Kuota ruang simpan arsip mingguan pada repository PBS / NetApp SnapVault Cold Storage',
    note: 'Dihitung per GB kuota backup (Mode Cold)',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 200, hourly: 0.27 },
    tier2: { monthly: 275, hourly: 0.38 },
    tier3: { monthly: 350, hourly: 0.48 },
  },
  {
    code: 'NET-IPV4',
    name: 'Dedicated IP Publik (IPv4)',
    unit: 'per 1 IP',
    coverage: '1 Alamat IPv4 Statis Publik (IP Private / VLAN Internal = Gratis)',
    note: 'Opsional sesuai kebutuhan akses publik',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 40000, hourly: 54.79 },
    tier2: { monthly: 50000, hourly: 68.49 },
    tier3: { monthly: 75000, hourly: 102.74 },
  },
  {
    code: 'NET-BWD',
    name: 'Bandwidth & Firewall Dasar',
    unit: 'per 1 VM',
    coverage: 'Trafik jaringan Unmetered (1 Gbps Shared) + Kebijakan Firewall Dasar',
    note: 'Wajib per 1 instance VM aktif',
    scheme: 'Bulanan Rutin',
    tier1: { monthly: 75000, hourly: 102.74 },
    tier2: { monthly: 100000, hourly: 136.99 },
    tier3: { monthly: 150000, hourly: 205.48 },
  },
];

export const TIER_DEFINITIONS = {
  TIER_1: {
    key: 'TIER_1',
    name: 'Tier 1 (Internal / Hemat)',
    badge: 'Hemat / Internal',
    desc: 'Untuk beban kerja internal, staging, dan lab pengujian non-kritis.',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    rates: {
      cpuHourly: 68.49,
      cpuMonthly: 50000,
      ramHourly: 34.25,
      ramMonthly: 25000,
      storageDefault: 'STR-SSATA',
      storageRates: {
        'STR-HSATA': { hourly: 0.55, monthly: 400 },
        'STR-HSAS': { hourly: 0.89, monthly: 650 },
        'STR-SSATA': { hourly: 1.30, monthly: 950 },
        'STR-SSAS': { hourly: 1.64, monthly: 1200 },
      },
      virtMonthly: 10000,
      manCostMonthly: 100000,
      bandwidthMonthly: 75000,
      setupFeeOTC: 150000,
      dedicatedIPMonthly: 40000,
    }
  },
  TIER_2: {
    key: 'TIER_2',
    name: 'Tier 2 (Standar PT)',
    badge: 'Standar PT PAL',
    desc: 'Untuk server aplikasi standar perusahaan, web service, dan basis data operasional.',
    color: '#1e3a8a',
    bg: '#eff6ff',
    border: '#bfdbfe',
    rates: {
      cpuHourly: 100.00,
      cpuMonthly: 73000,
      ramHourly: 50.00,
      ramMonthly: 36500,
      storageDefault: 'STR-SSATA',
      storageRates: {
        'STR-HSATA': { hourly: 0.68, monthly: 500 },
        'STR-HSAS': { hourly: 1.10, monthly: 800 },
        'STR-SSATA': { hourly: 1.51, monthly: 1100 },
        'STR-SSAS': { hourly: 1.92, monthly: 1400 },
      },
      virtMonthly: 15000,
      manCostMonthly: 150000,
      bandwidthMonthly: 100000,
      setupFeeOTC: 250000,
      dedicatedIPMonthly: 50000,
    }
  },
  TIER_3: {
    key: 'TIER_3',
    name: 'Tier 3 (Enterprise / HA)',
    badge: 'Enterprise / High Availability',
    desc: 'Untuk sistem produksi misi kritis, ERP galangan kapal, dan cluster database redundan.',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    rates: {
      cpuHourly: 136.99,
      cpuMonthly: 100000,
      ramHourly: 68.49,
      ramMonthly: 50000,
      storageDefault: 'STR-SSATA',
      storageRates: {
        'STR-HSATA': { hourly: 0.89, monthly: 650 },
        'STR-HSAS': { hourly: 1.37, monthly: 1000 },
        'STR-SSATA': { hourly: 1.85, monthly: 1350 },
        'STR-SSAS': { hourly: 2.40, monthly: 1750 },
      },
      virtMonthly: 25000,
      manCostMonthly: 250000,
      bandwidthMonthly: 150000,
      setupFeeOTC: 350000,
      dedicatedIPMonthly: 75000,
    }
  }
};

/**
 * Menghitung biaya bulanan Add-On Backup berdasarkan Tier, Hypervisor (Proxmox=PBS, VMware=NetApp), dan Mode (WARM/COLD)
 */
export const calculateBackupAddonCost = (tierKey, hypervisorType, backupMode, backupQuotaGB, diskGB = 50, requestedProvider = '') => {
  const mode = (backupMode || 'NONE').toUpperCase();
  if (mode !== 'WARM' && mode !== 'COLD') {
    return { baseMonthly: 0, storageMonthly: 0, totalMonthly: 0, provider: 'NONE', providerLabel: 'Tanpa Backup' };
  }

  const isVMware = (hypervisorType || '').toUpperCase() === 'VMWARE';
  const reqProv = (requestedProvider || '').toUpperCase();
  const provider = isVMware ? (reqProv === 'VEEAM' ? 'VEEAM' : 'NETAPP') : 'PBS';
  const providerLabel = !isVMware
    ? 'Proxmox Backup Server (PBS)'
    : provider === 'VEEAM'
      ? 'Veeam Backup & Replication (VUL)'
      : 'NetApp ONTAP / SnapCenter';
  const quota = backupQuotaGB > 0 ? backupQuotaGB : diskGB;
  const tier = (tierKey || 'TIER_1').toUpperCase();

  let baseMonthly = 0;
  let repoPerGB = 0;

  if (isVMware) {
    // VMware -> NetApp
    if (mode === 'WARM') {
      baseMonthly = tier === 'TIER_3' ? 250000 : tier === 'TIER_2' ? 200000 : 150000;
      repoPerGB = tier === 'TIER_3' ? 500 : tier === 'TIER_2' ? 400 : 300;
    } else {
      baseMonthly = tier === 'TIER_3' ? 175000 : tier === 'TIER_2' ? 130000 : 95000;
      repoPerGB = tier === 'TIER_3' ? 350 : tier === 'TIER_2' ? 275 : 200;
    }
  } else {
    // Proxmox -> PBS
    if (mode === 'WARM') {
      baseMonthly = tier === 'TIER_3' ? 100000 : tier === 'TIER_2' ? 75000 : 50000;
      repoPerGB = tier === 'TIER_3' ? 500 : tier === 'TIER_2' ? 400 : 300;
    } else {
      baseMonthly = tier === 'TIER_3' ? 65000 : tier === 'TIER_2' ? 45000 : 30000;
      repoPerGB = tier === 'TIER_3' ? 350 : tier === 'TIER_2' ? 275 : 200;
    }
  }

  const storageMonthly = quota * repoPerGB;
  return {
    baseMonthly,
    repoPerGB,
    quotaGB: quota,
    storageMonthly,
    totalMonthly: baseMonthly + storageMonthly,
    provider,
    providerLabel,
    mode
  };
};

export const formatCurrencyIDR = (val, maxFraction = 0) => {
  if (val === undefined || val === null || isNaN(val)) val = 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: maxFraction,
    minimumFractionDigits: maxFraction
  }).format(val);
};

export const formatNumber = (val, maxFraction = 2) => {
  if (val === undefined || val === null || isNaN(val)) val = 0;
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: maxFraction,
    minimumFractionDigits: maxFraction
  }).format(val);
};
