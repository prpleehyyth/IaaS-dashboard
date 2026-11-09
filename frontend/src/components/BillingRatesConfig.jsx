import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Cpu, 
  Database, 
  HardDrive, 
  Wifi, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Info,
  Shield,
  Layers,
  ArrowRight,
  Receipt,
  FileText
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

export default function BillingRatesConfig({ onRatesUpdated, onNavigateBilling }) {
  const [currency, setCurrency] = useState('IDR');
  const [activeTier, setActiveTier] = useState('TIER_1');
  const [storageType, setStorageType] = useState('STR-SSATA');
  
  // Rate states
  const [cpuRateHourly, setCpuRateHourly] = useState(68.49);
  const [ramRateHourly, setRamRateHourly] = useState(34.25);
  const [storageRateHourly, setStorageRateHourly] = useState(1.30);
  const [networkRateHourly, setNetworkRateHourly] = useState(54.79);
  
  // Monthly service rates
  const [virtRateMonthly, setVirtRateMonthly] = useState(10000);
  const [manCostMonthly, setManCostMonthly] = useState(100000);
  const [bandwidthMonthly, setBandwidthMonthly] = useState(75000);
  const [setupFeeOTC, setSetupFeeOTC] = useState(150000);
  const [hoursPerMonth, setHoursPerMonth] = useState(730);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadRates = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.getBillingRates();
      if (data) {
        setCurrency(data.currency || 'IDR');
        const tier = data.active_tier || 'TIER_1';
        setActiveTier(tier);
        setStorageType(data.storage_type || 'STR-SSATA');
        setCpuRateHourly(data.cpu_rate_hourly || 68.49);
        setRamRateHourly(data.ram_rate_hourly || 34.25);
        setStorageRateHourly(data.storage_rate_hourly || 1.30);
        setNetworkRateHourly(data.network_rate_hourly || 54.79);
        setVirtRateMonthly(data.virt_rate_monthly || 10000);
        setManCostMonthly(data.man_cost_monthly || 100000);
        setBandwidthMonthly(data.bandwidth_monthly || 75000);
        setSetupFeeOTC(data.setup_fee_otc || 150000);
        setHoursPerMonth(data.hours_per_month || 730);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memuat tarif billing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const selectTier = (tierKey) => {
    const tierDef = TIER_DEFINITIONS[tierKey];
    if (!tierDef) return;

    setActiveTier(tierKey);
    const r = tierDef.rates;
    setCpuRateHourly(r.cpuHourly);
    setRamRateHourly(r.ramHourly);
    
    // Pick storage rate for current storageType
    const stRates = r.storageRates[storageType] || r.storageRates['STR-SSATA'];
    setStorageRateHourly(stRates.hourly);
    
    setVirtRateMonthly(r.virtMonthly);
    setManCostMonthly(r.manCostMonthly);
    setBandwidthMonthly(r.bandwidthMonthly);
    setSetupFeeOTC(r.setupFeeOTC);
    setNetworkRateHourly(parseFloat((r.dedicatedIPMonthly / 730).toFixed(2)));
    setHoursPerMonth(730);
  };

  const handleStorageTypeChange = (newType) => {
    setStorageType(newType);
    const tierDef = TIER_DEFINITIONS[activeTier];
    if (tierDef && tierDef.rates.storageRates[newType]) {
      setStorageRateHourly(tierDef.rates.storageRates[newType].hourly);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.updateBillingRates({
        currency,
        active_tier: activeTier,
        storage_type: storageType,
        cpu_rate_hourly: parseFloat(cpuRateHourly),
        ram_rate_hourly: parseFloat(ramRateHourly),
        storage_rate_hourly: parseFloat(storageRateHourly),
        network_rate_hourly: parseFloat(networkRateHourly),
        virt_rate_monthly: parseFloat(virtRateMonthly),
        man_cost_monthly: parseFloat(manCostMonthly),
        bandwidth_monthly: parseFloat(bandwidthMonthly),
        setup_fee_otc: parseFloat(setupFeeOTC),
        hours_per_month: parseFloat(hoursPerMonth || 730),
      });
      setSuccessMsg(`Tarif billing ${TIER_DEFINITIONS[activeTier]?.name || activeTier} berhasil disimpan dan diterapkan!`);
      if (onRatesUpdated) onRatesUpdated();
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan tarif billing');
    } finally {
      setSaving(false);
    }
  };

  // Standard VM Simulation: 4 vCPU, 8 GB RAM, 50 GB Storage
  const simCores = 4;
  const simRamGB = 8;
  const simDiskGB = 50;

  const simCpuMonthly = simCores * (cpuRateHourly * hoursPerMonth);
  const simRamMonthly = simRamGB * (ramRateHourly * hoursPerMonth);
  const simStorageMonthly = simDiskGB * (storageRateHourly * hoursPerMonth);
  const simVirtMonthly = simCores * virtRateMonthly;
  const simManMonthly = manCostMonthly;
  const simBwMonthly = bandwidthMonthly;

  const simTotalMonthly = simCpuMonthly + simRamMonthly + simStorageMonthly + simVirtMonthly + simManMonthly + simBwMonthly;
  const simTotalHourly = simTotalMonthly / hoursPerMonth;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '26px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Katalog Tarif & Biaya IaaS</h1>
            <span style={{ 
              fontSize: '0.8rem', 
              background: '#eff6ff', 
              color: '#1e3a8a', 
              border: '1px solid #bfdbfe', 
              padding: '3px 10px', 
              borderRadius: '6px', 
              fontWeight: 700 
            }}>
              Sistem Tier 1, 2, & 3
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            Kelola skema harga sewa server VM korporasi PT PAL Indonesia berdasarkan katalog resmi (Acuan 730 Jam/Bulan).
          </p>
        </div>

        {onNavigateBilling && (
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={onNavigateBilling}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Receipt size={14} />
            <span>Lihat Laporan Billing</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 18px', borderRadius: '10px', color: '#065f46', fontSize: '0.88rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 18px', borderRadius: '10px', color: '#dc2626', fontSize: '0.88rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tier Preset Selector Cards */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
          Pilih Klasifikasi Tier Aktif:
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Klik salah satu tier di bawah untuk memuat nilai tarif resmi dari katalog secara otomatis.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
          {Object.entries(TIER_DEFINITIONS).map(([key, tier]) => {
            const isSelected = activeTier === key;
            return (
              <div 
                key={key}
                onClick={() => selectTier(key)}
                className="glass-panel"
                style={{ 
                  padding: '20px', 
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${tier.color}` : '1px solid var(--border-subtle)',
                  background: isSelected ? tier.bg : '#ffffff',
                  boxShadow: isSelected ? '0 8px 24px rgba(30, 58, 138, 0.12)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {isSelected && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '12px', 
                    right: '12px', 
                    background: tier.color, 
                    color: '#fff', 
                    fontSize: '0.7rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle2 size={12} />
                    <span>Aktif Terpasang</span>
                  </div>
                )}

                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tier.color, marginBottom: '4px' }}>
                  {tier.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px', minHeight: '36px' }}>
                  {tier.desc}
                </div>

                <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>vCPU Core:</span>
                    <strong style={{ color: '#1e3a8a' }}>{formatCurrencyIDR(tier.rates.cpuMonthly)} / bln</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Memory (RAM):</span>
                    <strong style={{ color: '#059669' }}>{formatCurrencyIDR(tier.rates.ramMonthly)} / GB / bln</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SSD Enterprise:</span>
                    <strong style={{ color: '#b45309' }}>{formatCurrencyIDR(tier.rates.storageRates['STR-SSATA'].monthly)} / GB / bln</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Setup (OTC):</span>
                    <strong style={{ color: '#64748b' }}>{formatCurrencyIDR(tier.rates.setupFeeOTC)} (1x)</strong>
                  </div>
                </div>

                <button 
                  type="button" 
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectTier(key);
                  }}
                >
                  {isSelected ? '✓ Tier Terpilih' : 'Terapkan Tier Ini'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '22px', marginBottom: '28px' }}>
          
          {/* Card 1: Komponen Utama Compute & Storage */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Cpu size={18} style={{ color: 'var(--ocean-blue)' }} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  1. Komponen Utama (Compute & Storage)
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Acuan formula: Harga Bulanan ÷ 730 Jam
                </span>
              </div>
            </div>

            {/* vCPU Rate */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>vCPU (CMP-CPU) / Core / Jam</label>
                <span style={{ fontSize: '0.78rem', color: '#1e3a8a', fontWeight: 700 }}>
                  = {formatCurrencyIDR(cpuRateHourly * hoursPerMonth)} / bln
                </span>
              </div>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                value={cpuRateHourly}
                onChange={(e) => setCpuRateHourly(e.target.value)}
                required
              />
            </div>

            {/* RAM Rate */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Memory (CMP-RAM) / GB / Jam</label>
                <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>
                  = {formatCurrencyIDR(ramRateHourly * hoursPerMonth)} / GB / bln
                </span>
              </div>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                value={ramRateHourly}
                onChange={(e) => setRamRateHourly(e.target.value)}
                required
              />
            </div>

            {/* Storage Type Selection */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Tipe Storage Bawaan (Default Disk)</label>
              <select 
                className="form-select"
                value={storageType}
                onChange={(e) => handleStorageTypeChange(e.target.value)}
              >
                <option value="STR-SSATA">STR-SSATA: SSD SATA Enterprise 6Gbps (Web, DB Menengah)</option>
                <option value="STR-SSAS">STR-SSAS: SSD SAS Enterprise 12Gbps (Production ERP & High IOPS)</option>
                <option value="STR-HSAS">STR-HSAS: HDD SAS 10K/15K RPM (Standard VM & App Internal)</option>
                <option value="STR-HSATA">STR-HSATA: HDD SATA 7.2K RPM (Cold Data, Backup, Archive)</option>
              </select>
            </div>

            {/* Storage Rate */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Tarif Storage Aktif / GB / Jam</label>
                <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 700 }}>
                  = {formatCurrencyIDR(storageRateHourly * hoursPerMonth)} / GB / bln
                </span>
              </div>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                value={storageRateHourly}
                onChange={(e) => setStorageRateHourly(e.target.value)}
                required
              />
            </div>

            {/* Setup Fee OTC */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Setup, Provisioning & Hardening (OTC-STP)</label>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Sekali Bayar (OTC)</span>
              </div>
              <input 
                type="number" 
                step="1000" 
                className="form-input" 
                value={setupFeeOTC}
                onChange={(e) => setSetupFeeOTC(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Card 2: Virtualisasi, Man Cost & Jaringan */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <Layers size={18} style={{ color: '#1e3a8a' }} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  2. Virtualisasi, Man Cost & Jaringan
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Komponen operasional & maintenance bulanan rutin
                </span>
              </div>
            </div>

            {/* Cost Virtualization */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Cost Virtualization (VRT-CST) / Core / Bulan</label>
                <span style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>
                  Rp {(virtRateMonthly / hoursPerMonth).toFixed(2)}/jam
                </span>
              </div>
              <input 
                type="number" 
                step="100" 
                className="form-input" 
                value={virtRateMonthly}
                onChange={(e) => setVirtRateMonthly(e.target.value)}
                required
              />
            </div>

            {/* Man Cost */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Man Cost Engineer (MAN-CST) / VM / Bulan</label>
                <span style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>
                  Rp {(manCostMonthly / hoursPerMonth).toFixed(2)}/jam
                </span>
              </div>
              <input 
                type="number" 
                step="1000" 
                className="form-input" 
                value={manCostMonthly}
                onChange={(e) => setManCostMonthly(e.target.value)}
                required
              />
            </div>

            {/* Bandwidth & Firewall */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Bandwidth 1 Gbps & Firewall (NET-BWD) / VM / Bulan</label>
                <span style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>
                  Rp {(bandwidthMonthly / hoursPerMonth).toFixed(2)}/jam
                </span>
              </div>
              <input 
                type="number" 
                step="1000" 
                className="form-input" 
                value={bandwidthMonthly}
                onChange={(e) => setBandwidthMonthly(e.target.value)}
                required
              />
            </div>

            {/* Dedicated IP Public */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Dedicated IP Publik IPv4 (NET-IPV4) / IP / Jam</label>
                <span style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>
                  = {formatCurrencyIDR(networkRateHourly * hoursPerMonth)} / bln
                </span>
              </div>
              <input 
                type="number" 
                step="0.01" 
                className="form-input" 
                value={networkRateHourly}
                onChange={(e) => setNetworkRateHourly(e.target.value)}
                required
              />
            </div>

            {/* Hours baseline */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Standar Jam Operasional per Bulan</label>
                <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>Acuan Katalog Resmi</span>
              </div>
              <input 
                type="number" 
                step="1" 
                className="form-input" 
                value={hoursPerMonth}
                onChange={(e) => setHoursPerMonth(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Real-time Benchmark Simulation Card */}
        <div className="glass-panel" style={{ padding: '20px 24px', background: '#f8fafc', marginBottom: '24px', borderLeft: '4px solid var(--ocean-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: 'var(--ocean-blue)' }} />
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Simulasi Benchmark VM Standar (4 vCPU, 8 GB RAM, 50 GB {storageType})
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#1e3a8a', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>
              {TIER_DEFINITIONS[activeTier]?.name}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '14px', fontSize: '0.82rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Compute (4 vCPU):</div>
              <div style={{ fontWeight: 700, color: '#1e3a8a' }}>{formatCurrencyIDR(simCpuMonthly)}/bln</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Memory (8 GB):</div>
              <div style={{ fontWeight: 700, color: '#059669' }}>{formatCurrencyIDR(simRamMonthly)}/bln</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Storage (50 GB):</div>
              <div style={{ fontWeight: 700, color: '#b45309' }}>{formatCurrencyIDR(simStorageMonthly)}/bln</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Virtualisasi & Ops:</div>
              <div style={{ fontWeight: 700, color: '#7c3aed' }}>{formatCurrencyIDR(simVirtMonthly + simManMonthly + simBwMonthly)}/bln</div>
            </div>
            <div style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: '12px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Total Bulanan (730 jam):</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrencyIDR(simTotalMonthly)}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>≈ Rp {formatNumber(simTotalHourly, 2)} / jam</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={loadRates}
            disabled={saving || loading}
          >
            Reset ke Data Tersimpan
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={saving || loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Menyimpan Tarif...' : 'Simpan & Terapkan Tarif'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
