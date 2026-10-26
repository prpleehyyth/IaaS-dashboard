import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Cpu, 
  Database, 
  HardDrive, 
  Wifi, 
  Sliders, 
  RefreshCw, 
  FileText, 
  ShieldCheck, 
  UserCheck, 
  CheckCircle2, 
  Server,
  ArrowRight,
  Calculator,
  Download,
  Layers,
  Sparkles,
  Shield,
  HelpCircle
} from 'lucide-react';
import { api } from '../api/client';
import { 
  HOURS_PER_MONTH, 
  TIER_DEFINITIONS, 
  COMPUTE_STORAGE_CATALOG, 
  SERVICES_LICENSE_CATALOG,
  formatCurrencyIDR,
  formatNumber
} from '../constants/pricingCatalog';

export default function BillingPreview({ user, onNavigateRates }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('vms'); // 'vms' | 'catalog' | 'calculator'
  const [catalogTierFilter, setCatalogTierFilter] = useState('ALL'); // 'ALL' | 'TIER_1' | 'TIER_2' | 'TIER_3'

  // Calculator State
  const [calcTier, setCalcTier] = useState('TIER_1');
  const [calcCpu, setCalcCpu] = useState(4);
  const [calcRamGB, setCalcRamGB] = useState(8);
  const [calcDiskType, setCalcDiskType] = useState('STR-SSATA');
  const [calcDiskGB, setCalcDiskGB] = useState(50);
  const [calcOS, setCalcOS] = useState('FREE'); // 'FREE' | 'RHEL'
  const [calcBackup, setCalcBackup] = useState('NONE'); // 'NONE' | 'PBS' | 'VEEAM'
  const [calcBackupGB, setCalcBackupGB] = useState(50);
  const [calcDedicatedIP, setCalcDedicatedIP] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || api.isAdmin();

  const loadBilling = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getBillingReport();
      setReport(data);
    } catch (err) {
      console.error("Failed to load billing report:", err);
      setError(err.message || 'Gagal memuat laporan billing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, [user]);

  const activeTierKey = report?.rates?.active_tier || report?.active_tier || 'TIER_1';
  const activeTierDef = TIER_DEFINITIONS[activeTierKey] || TIER_DEFINITIONS.TIER_1;
  const hoursBaseline = report?.rates?.hours_per_month || HOURS_PER_MONTH;

  // Export current table to CSV
  const exportToCSV = () => {
    if (!report?.vms || report.vms.length === 0) return;
    const headers = [
      'Nama VM',
      'Status',
      'Cluster / Node',
      'Operator',
      'vCPU (Cores)',
      'Biaya vCPU/Bln',
      'RAM (GB)',
      'Biaya RAM/Bln',
      'Storage (GB)',
      'Biaya Storage/Bln',
      'Virtualisasi/Bln',
      'Man Cost/Bln',
      'Bandwidth/Bln',
      'Total Biaya/Jam',
      'Total Biaya/Bulan',
      'Setup Fee (OTC)'
    ];

    const rows = report.vms.map(vm => [
      `"${vm.vm_name}"`,
      vm.status,
      `"${vm.cluster_name} / ${vm.node_name}"`,
      `"${vm.assigned_user_name || '-'}"`,
      vm.cpu_cores,
      Math.round(vm.cpu_cost_hourly * hoursBaseline),
      Math.round(vm.ram_mb / 1024),
      Math.round(vm.ram_cost_hourly * hoursBaseline),
      vm.disk_gb,
      Math.round(vm.storage_cost_hourly * hoursBaseline),
      Math.round(vm.virt_cost_hourly * hoursBaseline),
      Math.round(vm.man_cost_hourly * hoursBaseline),
      Math.round(vm.bandwidth_cost_hourly * hoursBaseline),
      vm.total_hourly,
      vm.total_monthly,
      vm.setup_fee_otc || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `billing_iaas_pal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculator computation based on PDF catalog
  const calcTierDef = TIER_DEFINITIONS[calcTier] || TIER_DEFINITIONS.TIER_1;
  const calcStorageInfo = calcTierDef.rates.storageRates[calcDiskType] || calcTierDef.rates.storageRates['STR-SSATA'];

  const calcCpuMonthly = calcCpu * calcTierDef.rates.cpuMonthly;
  const calcRamMonthly = calcRamGB * calcTierDef.rates.ramMonthly;
  const calcDiskMonthly = calcDiskGB * calcStorageInfo.monthly;
  const calcVirtMonthly = calcCpu * calcTierDef.rates.virtMonthly;
  const calcManMonthly = calcTierDef.rates.manCostMonthly;
  const calcBwMonthly = calcTierDef.rates.bandwidthMonthly;

  // Add-ons
  let calcOSMonthly = 0;
  if (calcOS === 'RHEL') {
    // LIC-RHEL: per 2 Core (1 Sub covers up to 2 vCPU)
    const subCount = Math.ceil(calcCpu / 2);
    calcOSMonthly = subCount * (calcTier === 'TIER_1' ? 160000 : calcTier === 'TIER_2' ? 185000 : 225000);
  }

  let calcBackupMonthly = 0;
  if (calcBackup === 'PBS') {
    calcBackupMonthly = (calcTier === 'TIER_1' ? 50000 : calcTier === 'TIER_2' ? 75000 : 100000) +
      (calcBackupGB * (calcTier === 'TIER_1' ? 300 : calcTier === 'TIER_2' ? 400 : 500));
  } else if (calcBackup === 'VEEAM') {
    calcBackupMonthly = (calcTier === 'TIER_1' ? 150000 : calcTier === 'TIER_2' ? 200000 : 250000) +
      (calcBackupGB * (calcTier === 'TIER_1' ? 300 : calcTier === 'TIER_2' ? 400 : 500));
  }

  const calcIpMonthly = calcDedicatedIP ? calcTierDef.rates.dedicatedIPMonthly : 0;
  const calcTotalMonthly = calcCpuMonthly + calcRamMonthly + calcDiskMonthly + calcVirtMonthly + calcManMonthly + calcBwMonthly + calcOSMonthly + calcBackupMonthly + calcIpMonthly;
  const calcTotalHourly = calcTotalMonthly / hoursBaseline;
  const calcSetupOTC = calcTierDef.rates.setupFeeOTC;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isAdmin ? 'Laporan Billing & Sewa Server IaaS' : 'Billing & Biaya VM Saya'}
            </h1>
            <span style={{ 
              fontSize: '0.8rem', 
              background: activeTierDef.bg, 
              color: activeTierDef.color, 
              border: `1px solid ${activeTierDef.border}`, 
              padding: '3px 10px', 
              borderRadius: '6px', 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <CheckCircle2 size={13} />
              <span>{activeTierDef.name}</span>
            </span>
            <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Acuan {hoursBaseline} Jam/Bulan
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            Perhitungan biaya sewa infrastruktur VM korporasi PT PAL Indonesia berdasarkan katalog resmi Tier 1, Tier 2, dan Tier 3.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={exportToCSV}
            disabled={!report?.vms || report.vms.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={13} />
            <span>Ekspor CSV</span>
          </button>

          {isAdmin && onNavigateRates && (
            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={onNavigateRates}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sliders size={13} />
              <span>Kelola Tarif</span>
            </button>
          )}

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={loadBilling}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '10px', color: '#dc2626', fontSize: '0.88rem', marginBottom: '22px' }}>
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '22px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('vms')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'vms' ? 'var(--ocean-blue)' : 'var(--text-muted)',
            borderBottom: activeTab === 'vms' ? '2px solid var(--ocean-blue)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Receipt size={16} />
          <span>Tagihan Virtual Machine ({report?.total_vms || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'catalog' ? 'var(--ocean-blue)' : 'var(--text-muted)',
            borderBottom: activeTab === 'catalog' ? '2px solid var(--ocean-blue)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} />
          <span>Katalog Harga Resmi (PDF)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            color: activeTab === 'calculator' ? 'var(--ocean-blue)' : 'var(--text-muted)',
            borderBottom: activeTab === 'calculator' ? '2px solid var(--ocean-blue)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Calculator size={16} />
          <span>Kalkulator Simulasi Sewa VM</span>
        </button>
      </div>

      {/* TAB 1: TAGIHAN PER VIRTUAL MACHINE */}
      {activeTab === 'vms' && (
        <>
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                TOTAL BIAYA BULANAN ({hoursBaseline} JAM)
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--ocean-blue)' }}>
                {formatCurrencyIDR(report?.total_monthly || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '4px', fontWeight: 600 }}>
                ≈ {formatCurrencyIDR(report?.total_hourly || 0, 2)} / jam
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                TOTAL ALOKASI COMPUTE
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1e3a8a' }}>
                {report?.total_cpu_cores || 0} vCPU
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                RAM: <strong>{report?.total_ram_gb || 0} GB</strong> Memory
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                TOTAL STORAGE VOLUME
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#b45309' }}>
                {report?.total_disk_gb || 0} GB
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Tipe: <strong>{report?.rates?.storage_type || 'SSD Enterprise'}</strong>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                SETUP & HARDENING (OTC)
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#475569' }}>
                {formatCurrencyIDR(report?.total_setup_otc || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ditagihkan 1x pada bulan pertama
              </div>
            </div>
          </div>

          {/* Active Rate Banner */}
          {report?.rates && (
            <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: '22px', background: '#f8fafc', borderLeft: '4px solid var(--ocean-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={16} style={{ color: 'var(--ocean-blue)' }} />
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Rincian Tarif {activeTierDef.name}:
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                  <span style={{ color: '#1e3a8a', fontWeight: 600 }}>
                    vCPU: <strong>Rp {formatNumber(report.rates.cpu_rate_hourly, 2)}</strong>/jam ({formatCurrencyIDR(report.rates.cpu_rate_hourly * hoursBaseline)}/bln)
                  </span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>
                    RAM: <strong>Rp {formatNumber(report.rates.ram_rate_hourly, 2)}</strong>/GB/jam ({formatCurrencyIDR(report.rates.ram_rate_hourly * hoursBaseline)}/bln)
                  </span>
                  <span style={{ color: '#b45309', fontWeight: 600 }}>
                    Storage: <strong>Rp {formatNumber(report.rates.storage_rate_hourly, 2)}</strong>/GB/jam ({formatCurrencyIDR(report.rates.storage_rate_hourly * hoursBaseline)}/bln)
                  </span>
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>
                    Virtualisasi: <strong>{formatCurrencyIDR(report.rates.virt_rate_monthly || 10000)}</strong>/core/bln
                  </span>
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>
                    Man Cost: <strong>{formatCurrencyIDR(report.rates.man_cost_monthly || 100000)}</strong>/VM/bln
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VM Table */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Virtual Machine</th>
                    <th>Spesifikasi</th>
                    <th>Biaya Compute</th>
                    <th>Biaya Storage</th>
                    <th>Virtualisasi & Ops</th>
                    <th style={{ textAlign: 'right' }}>Total / Jam</th>
                    <th style={{ textAlign: 'right' }}>Total / Bulan</th>
                  </tr>
                </thead>
                <tbody>
                  {(!report?.vms || report.vms.length === 0) ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Belum ada virtual machine terdaftar untuk skema billing saat ini.
                      </td>
                    </tr>
                  ) : (
                    report.vms.map(vm => (
                      <tr key={vm.vm_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                            {vm.vm_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {vm.cluster_name} • {vm.node_name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#1e3a8a', fontWeight: 600, marginTop: '2px' }}>
                            User: {vm.assigned_user_name || 'Fleet'}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {vm.cpu_cores} vCPU • {Math.round(vm.ram_mb / 1024)} GB RAM
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Disk: {vm.disk_gb} GB ({report?.rates?.storage_type || 'SSD'})
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e3a8a' }}>
                            {formatCurrencyIDR((vm.cpu_cost_hourly + vm.ram_cost_hourly) * hoursBaseline)} / bln
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            vCPU: {formatCurrencyIDR(vm.cpu_cost_hourly * hoursBaseline)} • RAM: {formatCurrencyIDR(vm.ram_cost_hourly * hoursBaseline)}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#b45309' }}>
                            {formatCurrencyIDR(vm.storage_cost_hourly * hoursBaseline)} / bln
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Rp {formatNumber(vm.storage_cost_hourly, 2)} / jam
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7c3aed' }}>
                            {formatCurrencyIDR(((vm.virt_cost_hourly || 0) + (vm.man_cost_hourly || 0) + (vm.bandwidth_cost_hourly || 0)) * hoursBaseline)} / bln
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            VRT: {formatCurrencyIDR((vm.virt_cost_hourly || 0) * hoursBaseline)} • Ops: {formatCurrencyIDR(((vm.man_cost_hourly || 0) + (vm.bandwidth_cost_hourly || 0)) * hoursBaseline)}
                          </div>
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Rp {formatNumber(vm.total_hourly, 2)}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--ocean-blue)' }}>
                            {formatCurrencyIDR(vm.total_monthly)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Setup: {formatCurrencyIDR(vm.setup_fee_otc || 150000)} (1x)
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: KATALOG HARGA RESMI SESUAI PDF */}
      {activeTab === 'catalog' && (
        <div>
          {/* Catalog Filter Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Katalog Harga Sewa Server IaaS / VM Korporasi
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Daftar Harga Sewa Fix Bulanan & Per Jam (Acuan 730 Jam/Bulan) — Mencakup Compute, Storage, Virtualisasi, Man Cost, RedHat & Backup
              </p>
            </div>

            {/* Tier Filter Buttons */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '3px' }}>
              {[
                { id: 'ALL', label: 'Bandingkan Semua Tier' },
                { id: 'TIER_1', label: 'Tier 1 (Internal)' },
                { id: 'TIER_2', label: 'Tier 2 (Standar PT)' },
                { id: 'TIER_3', label: 'Tier 3 (Enterprise)' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCatalogTierFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: catalogTierFilter === f.id ? '#ffffff' : 'transparent',
                    color: catalogTierFilter === f.id ? 'var(--ocean-blue)' : 'var(--text-muted)',
                    boxShadow: catalogTierFilter === f.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* TABEL 1: KOMPONEN UTAMA (COMPUTE & STORAGE) */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '26px' }}>
            <div style={{ background: '#1e3a8a', color: '#ffffff', padding: '14px 20px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>1. TABEL HARGA SEWA KOMPONEN UTAMA (COMPUTE & STORAGE)</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                Acuan 730 Jam / Bulan
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: '110px' }}>Kode Item</th>
                    <th style={{ width: '220px' }}>Komponen Resource</th>
                    <th>Satuan</th>
                    <th>Spesifikasi Teknis & Peruntukan</th>
                    {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_1') && (
                      <th style={{ textAlign: 'right', background: '#f0f9ff', color: '#0284c7' }}>
                        Tier 1 (Internal / Hemat)<br/>
                        <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Per Jam / Per Bulan</span>
                      </th>
                    )}
                    {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_2') && (
                      <th style={{ textAlign: 'right', background: '#eff6ff', color: '#1e3a8a' }}>
                        Tier 2 (Standar PT)<br/>
                        <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Per Jam / Per Bulan</span>
                      </th>
                    )}
                    {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_3') && (
                      <th style={{ textAlign: 'right', background: '#fffbeb', color: '#b45309' }}>
                        Tier 3 (Enterprise / HA)<br/>
                        <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>Per Jam / Per Bulan</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {COMPUTE_STORAGE_CATALOG.map(item => (
                    <tr key={item.code}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px' }}>
                          {item.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        {item.name}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {item.unit}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {item.spec}
                        {item.note && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                            * {item.note}
                          </div>
                        )}
                      </td>

                      {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_1') && (
                        <td style={{ textAlign: 'right', background: '#f8fafc' }}>
                          {item.tier1.isOTC ? (
                            <div>
                              <strong style={{ color: '#0284c7' }}>{formatCurrencyIDR(item.tier1.monthly)}</strong>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sekali Bayar (OTC)</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Rp {formatNumber(item.tier1.hourly, 2)} / jam
                              </div>
                              <strong style={{ color: '#0284c7' }}>{formatCurrencyIDR(item.tier1.monthly)}</strong> / bln
                            </div>
                          )}
                        </td>
                      )}

                      {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_2') && (
                        <td style={{ textAlign: 'right', background: '#f8fafc' }}>
                          {item.tier2.isOTC ? (
                            <div>
                              <strong style={{ color: '#1e3a8a' }}>{formatCurrencyIDR(item.tier2.monthly)}</strong>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sekali Bayar (OTC)</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Rp {formatNumber(item.tier2.hourly, 2)} / jam
                              </div>
                              <strong style={{ color: '#1e3a8a' }}>{formatCurrencyIDR(item.tier2.monthly)}</strong> / bln
                            </div>
                          )}
                        </td>
                      )}

                      {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_3') && (
                        <td style={{ textAlign: 'right', background: '#f8fafc' }}>
                          {item.tier3.isOTC ? (
                            <div>
                              <strong style={{ color: '#b45309' }}>{formatCurrencyIDR(item.tier3.monthly)}</strong>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sekali Bayar (OTC)</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Rp {formatNumber(item.tier3.hourly, 2)} / jam
                              </div>
                              <strong style={{ color: '#b45309' }}>{formatCurrencyIDR(item.tier3.monthly)}</strong> / bln
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABEL 2: VIRTUALISASI, MAN COST, LISENSI REDHAT, BACKUP & JARINGAN */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ background: '#0f172a', color: '#ffffff', padding: '14px 20px', fontWeight: 800, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>2. TABEL HARGA VIRTUALISASI, MAN COST, LISENSI REDHAT (RHEL), BACKUP & JARINGAN</span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                Skema Tagihan Bulanan Rutin
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: '110px' }}>Kode Item</th>
                    <th style={{ width: '220px' }}>Komponen Layanan / Lisensi</th>
                    <th>Satuan</th>
                    <th>Detail Cakupan Layanan & Ketentuan</th>
                    {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_1') && (
                      <th style={{ textAlign: 'right', background: '#f0f9ff', color: '#0284c7' }}>
                        Tier 1 (Internal / Hemat)
                      </th>
                    )}
                    {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_2') && (
                      <th style={{ textAlign: 'right', background: '#eff6ff', color: '#1e3a8a' }}>
                        Tier 2 (Standar PT)
                      </th>
                    )}
                    {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_3') && (
                      <th style={{ textAlign: 'right', background: '#fffbeb', color: '#b45309' }}>
                        Tier 3 (Enterprise / HA)
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {SERVICES_LICENSE_CATALOG.map(item => (
                    <tr key={item.code}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px' }}>
                          {item.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        {item.name}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {item.unit}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {item.coverage}
                        <div style={{ fontSize: '0.72rem', color: '#1e3a8a', fontWeight: 600, marginTop: '2px' }}>
                          Keterangan: {item.note}
                        </div>
                      </td>

                      {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_1') && (
                        <td style={{ textAlign: 'right', background: '#f8fafc' }}>
                          {item.tier1.monthly === 0 ? (
                            <span style={{ color: '#059669', fontWeight: 700 }}>Gratis (Rp 0)</span>
                          ) : (
                            <div>
                              <strong style={{ color: '#0284c7' }}>{formatCurrencyIDR(item.tier1.monthly)}</strong> / bln
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ≈ Rp {formatNumber(item.tier1.hourly, 2)} / jam
                              </div>
                            </div>
                          )}
                        </td>
                      )}

                      {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_2') && (
                        <td style={{ textAlign: 'right', background: '#f8fafc' }}>
                          {item.tier2.monthly === 0 ? (
                            <span style={{ color: '#059669', fontWeight: 700 }}>Gratis (Rp 0)</span>
                          ) : (
                            <div>
                              <strong style={{ color: '#1e3a8a' }}>{formatCurrencyIDR(item.tier2.monthly)}</strong> / bln
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ≈ Rp {formatNumber(item.tier2.hourly, 2)} / jam
                              </div>
                            </div>
                          )}
                        </td>
                      )}

                      {(catalogTierFilter === 'ALL' || catalogTierFilter === 'TIER_3') && (
                        <td style={{ textAlign: 'right', background: '#f8fafc' }}>
                          {item.tier3.monthly === 0 ? (
                            <span style={{ color: '#059669', fontWeight: 700 }}>Gratis (Rp 0)</span>
                          ) : (
                            <div>
                              <strong style={{ color: '#b45309' }}>{formatCurrencyIDR(item.tier3.monthly)}</strong> / bln
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ≈ Rp {formatNumber(item.tier3.hourly, 2)} / jam
                              </div>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KALKULATOR SIMULASI SEWA VM */}
      {activeTab === 'calculator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '24px' }}>
          
          {/* Configurator Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Calculator size={18} style={{ color: 'var(--ocean-blue)' }} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Konfigurator Resource VM
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Pilih spesifikasi untuk menghitung estimasi biaya sewa bulanan & per jam
                </span>
              </div>
            </div>

            {/* Tier Selection */}
            <div className="form-group">
              <label className="form-label">Klasifikasi Tier VM</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {Object.entries(TIER_DEFINITIONS).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCalcTier(k)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: calcTier === k ? `2px solid ${t.color}` : '1px solid var(--border-subtle)',
                      background: calcTier === k ? t.bg : '#ffffff',
                      color: calcTier === k ? t.color : 'var(--text-muted)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div>{t.name.split(' (')[0]}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 500, marginTop: '2px' }}>
                      {t.badge}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* CPU Slider */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>vCPU Compute (CMP-CPU):</span>
                <strong style={{ color: '#1e3a8a' }}>{calcCpu} Core ({formatCurrencyIDR(calcCpuMonthly)}/bln)</strong>
              </div>
              <input 
                type="range"
                min="1"
                max="32"
                value={calcCpu}
                onChange={(e) => setCalcCpu(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--ocean-blue)' }}
              />
            </div>

            {/* RAM Slider */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Memory vRAM (CMP-RAM):</span>
                <strong style={{ color: '#059669' }}>{calcRamGB} GB ({formatCurrencyIDR(calcRamMonthly)}/bln)</strong>
              </div>
              <input 
                type="range"
                min="1"
                max="64"
                value={calcRamGB}
                onChange={(e) => setCalcRamGB(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#059669' }}
              />
            </div>

            {/* Storage Type */}
            <div className="form-group">
              <label className="form-label">Tipe Storage (Disk RAID)</label>
              <select 
                className="form-select"
                value={calcDiskType}
                onChange={(e) => setCalcDiskType(e.target.value)}
              >
                <option value="STR-SSATA">STR-SSATA: SSD SATA Enterprise 6Gbps (Web & DB Menengah)</option>
                <option value="STR-SSAS">STR-SSAS: SSD SAS Enterprise 12Gbps (Production ERP & High IOPS)</option>
                <option value="STR-HSAS">STR-HSAS: HDD SAS 10K/15K RPM (Standar VM & App Internal)</option>
                <option value="STR-HSATA">STR-HSATA: HDD SATA 7.2K RPM (File Server, Archive, Cold Data)</option>
              </select>
            </div>

            {/* Storage Volume Slider */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Kapasitas Storage:</span>
                <strong style={{ color: '#b45309' }}>{calcDiskGB} GB ({formatCurrencyIDR(calcDiskMonthly)}/bln)</strong>
              </div>
              <input 
                type="range"
                min="10"
                max="500"
                step="10"
                value={calcDiskGB}
                onChange={(e) => setCalcDiskGB(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#b45309' }}
              />
            </div>

            {/* Operating System */}
            <div className="form-group">
              <label className="form-label">Sistem Operasi (OS Subscription)</label>
              <select 
                className="form-select"
                value={calcOS}
                onChange={(e) => setCalcOS(e.target.value)}
              >
                <option value="FREE">Community Linux: Ubuntu, Debian, Rocky, AlmaLinux (Gratis Rp 0)</option>
                <option value="RHEL">Red Hat Enterprise Linux (LIC-RHEL) — Subskripsi Lisensi Resmi</option>
              </select>
            </div>

            {/* Backup Add-on */}
            <div className="form-group">
              <label className="form-label">Solusi Backup & Disaster Recovery</label>
              <select 
                className="form-select"
                value={calcBackup}
                onChange={(e) => setCalcBackup(e.target.value)}
              >
                <option value="NONE">Tanpa Lisensi Backup Tambahan (Backup Manual)</option>
                <option value="PBS">Proxmox Backup Server (BCK-PBS) — Deduplikasi & Enkripsi</option>
                <option value="VEEAM">Veeam Backup & Replication (BCK-VEEAM) — Enterprise Universal License</option>
              </select>
            </div>

            {/* Dedicated Public IP */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input 
                  type="checkbox"
                  checked={calcDedicatedIP}
                  onChange={(e) => setCalcDedicatedIP(e.target.checked)}
                  style={{ accentColor: 'var(--ocean-blue)', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: 600 }}>Tambahkan 1 Alamat Dedicated IP Publik IPv4 (NET-IPV4)</span>
              </label>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '24px', marginTop: '2px' }}>
                IP Private & VLAN Internal = Gratis. Centang jika VM membutuhkan akses langsung dari internet.
              </div>
            </div>
          </div>

          {/* Quotation Preview Card */}
          <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Receipt size={18} style={{ color: '#1e3a8a' }} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Ringkasan Estimasi Biaya Sewa
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Perhitungan resmi berdasarkan katalog PT PAL (Acuan 730 jam/bln)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.84rem', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                <span>vCPU Compute ({calcCpu} Core × {formatCurrencyIDR(calcTierDef.rates.cpuMonthly)}):</span>
                <strong style={{ color: '#1e3a8a' }}>{formatCurrencyIDR(calcCpuMonthly)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                <span>Memory vRAM ({calcRamGB} GB × {formatCurrencyIDR(calcTierDef.rates.ramMonthly)}):</span>
                <strong style={{ color: '#059669' }}>{formatCurrencyIDR(calcRamMonthly)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                <span>Storage ({calcDiskGB} GB {calcDiskType}):</span>
                <strong style={{ color: '#b45309' }}>{formatCurrencyIDR(calcDiskMonthly)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                <span>Cost Virtualization (VRT-CST, {calcCpu} vCPU):</span>
                <strong style={{ color: '#7c3aed' }}>{formatCurrencyIDR(calcVirtMonthly)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                <span>Man Cost Engineer 24/7 (MAN-CST):</span>
                <strong style={{ color: '#7c3aed' }}>{formatCurrencyIDR(calcManMonthly)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                <span>Bandwidth 1 Gbps & Firewall (NET-BWD):</span>
                <strong style={{ color: '#7c3aed' }}>{formatCurrencyIDR(calcBwMonthly)}</strong>
              </div>

              {calcOS === 'RHEL' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                  <span>Lisensi RedHat (LIC-RHEL, {Math.ceil(calcCpu / 2)} sub):</span>
                  <strong style={{ color: '#dc2626' }}>{formatCurrencyIDR(calcOSMonthly)}</strong>
                </div>
              )}

              {calcBackup !== 'NONE' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                  <span>Lisensi & Storage Backup ({calcBackup}):</span>
                  <strong style={{ color: '#0284c7' }}>{formatCurrencyIDR(calcBackupMonthly)}</strong>
                </div>
              )}

              {calcDedicatedIP && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                  <span>Dedicated IP Publik (NET-IPV4):</span>
                  <strong style={{ color: '#1e3a8a' }}>{formatCurrencyIDR(calcIpMonthly)}</strong>
                </div>
              )}
            </div>

            {/* Total Monthly Box */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Total Sewa Bulanan Rutin:
                </span>
                <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--ocean-blue)' }}>
                  {formatCurrencyIDR(calcTotalMonthly)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Estimasi Biaya per Jam:</span>
                <strong style={{ color: '#0f172a' }}>Rp {formatNumber(calcTotalHourly, 2)} / jam</strong>
              </div>
            </div>

            {/* Setup Fee One-Time Box */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px 16px', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Setup, Provisioning & Hardening (OTC-STP):</strong>
                <div style={{ fontSize: '0.72rem' }}>Ditagihkan 1x pada bulan pertama</div>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                {formatCurrencyIDR(calcSetupOTC)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
