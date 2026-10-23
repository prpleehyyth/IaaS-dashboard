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
  Info
} from 'lucide-react';
import { api } from '../api/client';

export default function BillingRatesConfig({ onRatesUpdated, onNavigateBilling }) {
  const [currency, setCurrency] = useState('IDR');
  const [cpuRate, setCpuRate] = useState(250);
  const [ramRate, setRamRate] = useState(100);
  const [storageRate, setStorageRate] = useState(1.5);
  const [networkRate, setNetworkRate] = useState(50);
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
        setCpuRate(data.cpu_rate_hourly || 250);
        setRamRate(data.ram_rate_hourly || 100);
        setStorageRate(data.storage_rate_hourly || 1.5);
        setNetworkRate(data.network_rate_hourly || 50);
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.updateBillingRates({
        currency,
        cpu_rate_hourly: parseFloat(cpuRate),
        ram_rate_hourly: parseFloat(ramRate),
        storage_rate_hourly: parseFloat(storageRate),
        network_rate_hourly: parseFloat(networkRate),
      });
      setSuccessMsg('Tarif billing berhasil disimpan dan diterapkan ke seluruh VM!');
      if (onRatesUpdated) onRatesUpdated();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan tarif billing');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (presetName) => {
    if (presetName === 'pt-pal-standard') {
      setCurrency('IDR');
      setCpuRate(250);      // Rp 180.000 / bln
      setRamRate(100);      // Rp 72.000 / GB / bln
      setStorageRate(1.5);   // Rp 1.080 / GB / bln
      setNetworkRate(50);    // Rp 36.000 / IP / bln
    } else if (presetName === 'pt-pal-enterprise') {
      setCurrency('IDR');
      setCpuRate(400);      // Rp 288.000 / bln
      setRamRate(160);      // Rp 115.200 / GB / bln
      setStorageRate(2.5);   // Rp 1.800 / GB / bln
      setNetworkRate(100);   // Rp 72.000 / IP / bln
    } else if (presetName === 'usd-cloud') {
      setCurrency('USD');
      setCpuRate(0.02);     // $14.40 / bln
      setRamRate(0.008);    // $5.76 / GB / bln
      setStorageRate(0.00015); // $0.10 / GB / bln
      setNetworkRate(0.005);   // $3.60 / IP / bln
    }
  };

  // Simulation for standard VM: 2 vCPU, 4GB RAM, 50GB Disk, 1 Network
  const simCpuHourly = 2 * cpuRate;
  const simRamHourly = 4 * ramRate;
  const simStorageHourly = 50 * storageRate;
  const simNetHourly = 1 * networkRate;
  const simTotalHourly = simCpuHourly + simRamHourly + simStorageHourly + simNetHourly;
  const simTotalMonthly = simTotalHourly * 720;

  const formatPrice = (val) => {
    if (currency === 'IDR') {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(val);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(val);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '26px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Pengaturan Tarif Billing</h1>
            <span style={{ 
              fontSize: '0.8rem', 
              background: '#eff6ff', 
              color: '#1e3a8a', 
              border: '1px solid #bfdbfe', 
              padding: '3px 10px', 
              borderRadius: '6px', 
              fontWeight: 700 
            }}>
              Khusus Administrator
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            Kelola harga unit untuk komputasi CPU, memori RAM, storage, dan network. Tarif ini akan digunakan untuk menghitung tagihan VM setiap pengguna.
          </p>
        </div>

        {onNavigateBilling && (
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={onNavigateBilling}
          >
            Lihat Laporan Billing
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '10px', color: '#065f46', fontSize: '0.88rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '10px', color: '#dc2626', fontSize: '0.88rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '26px' }}>
        {/* Form Set Tarif */}
        <div className="glass-panel" style={{ padding: '26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={20} style={{ color: 'var(--ocean-blue)' }} />
              <span>Komponen Tarif Resource</span>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                type="button" 
                onClick={() => applyPreset('pt-pal-standard')}
                style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
              >
                PT PAL Standar
              </button>
              <button 
                type="button" 
                onClick={() => applyPreset('pt-pal-enterprise')}
                style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
              >
                Enterprise
              </button>
              <button 
                type="button" 
                onClick={() => applyPreset('usd-cloud')}
                style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
              >
                USD ($)
              </button>
            </div>
          </div>

          <form onSubmit={handleSave}>
            {/* Mata Uang */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label">Mata Uang Billing</label>
              <select 
                className="form-select" 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                style={{ maxWidth: '240px' }}
              >
                <option value="IDR">IDR — Rupiah Indonesia (Rp)</option>
                <option value="USD">USD — US Dollar ($)</option>
              </select>
            </div>

            {/* 1. CPU Rate */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Cpu size={18} style={{ color: 'var(--ocean-blue)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>1. Tarif vCPU Compute</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Harga per Core / Jam:
                  </label>
                  <input 
                    type="number" 
                    step="any" 
                    min="0"
                    className="form-input" 
                    value={cpuRate} 
                    onChange={(e) => setCpuRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#1e3a8a', background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontWeight: 600 }}>Estimasi Bulanan (720 jam):</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>
                    {formatPrice(cpuRate * 720)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ core / bln</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. RAM Rate */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Database size={18} style={{ color: '#059669' }} />
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>2. Tarif Memori RAM</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Harga per GB RAM / Jam:
                  </label>
                  <input 
                    type="number" 
                    step="any" 
                    min="0"
                    className="form-input" 
                    value={ramRate} 
                    onChange={(e) => setRamRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#065f46', background: '#ecfdf5', padding: '10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontWeight: 600 }}>Estimasi Bulanan (720 jam):</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>
                    {formatPrice(ramRate * 720)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ GB / bln</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Storage Rate */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <HardDrive size={18} style={{ color: '#b45309' }} />
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>3. Tarif Storage Disk (NVMe/SAN)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Harga per GB Disk / Jam:
                  </label>
                  <input 
                    type="number" 
                    step="any" 
                    min="0"
                    className="form-input" 
                    value={storageRate} 
                    onChange={(e) => setStorageRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fef3c7', padding: '10px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <div style={{ fontWeight: 600 }}>Estimasi Bulanan (720 jam):</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>
                    {formatPrice(storageRate * 720)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ GB / bln</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Network Rate */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Wifi size={18} style={{ color: '#7c3aed' }} />
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>4. Tarif Network Interface & IP</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Harga per VM Network / Jam:
                  </label>
                  <input 
                    type="number" 
                    step="any" 
                    min="0"
                    className="form-input" 
                    value={networkRate} 
                    onChange={(e) => setNetworkRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#5b21b6', background: '#f5f3ff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                  <div style={{ fontWeight: 600 }}>Estimasi Bulanan (720 jam):</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>
                    {formatPrice(networkRate * 720)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ IP / bln</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={saving || loading}
                style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Save size={16} />
                <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan Tarif'}</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={loadRates}
                disabled={loading || saving}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                <span>Reset</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Simulation Card */}
        <div>
          <div className="glass-panel" style={{ padding: '24px', position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Sparkles size={18} style={{ color: 'var(--accent-gold)' }} />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Simulasi Biaya VM Standar
              </h2>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Preview biaya berjalan untuk sebuah Virtual Machine dengan spesifikasi acuan (2 vCPU, 4GB RAM, 50GB Disk, 1 IP):
            </p>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ color: 'var(--text-muted)' }}>vCPU (2 cores):</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatPrice(simCpuHourly * 720)} / bln</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ color: 'var(--text-muted)' }}>RAM (4 GB):</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatPrice(simRamHourly * 720)} / bln</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Storage (50 GB):</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatPrice(simStorageHourly * 720)} / bln</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Network (1 IP):</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatPrice(simNetHourly * 720)} / bln</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', background: '#eff6ff', padding: '18px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Biaya VM Standar
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', margin: '6px 0' }}>
                {formatPrice(simTotalMonthly)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                atau ~{formatPrice(simTotalHourly)} / jam
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', fontSize: '0.76rem', color: 'var(--text-muted)', background: '#fffbeb', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <Info size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: '2px' }} />
              <span>
                Begitu tarif disimpan, seluruh laporan billing untuk user/operator akan langsung terupdate secara real-time.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
