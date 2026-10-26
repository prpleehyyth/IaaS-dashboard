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
  ArrowRight
} from 'lucide-react';
import { api } from '../api/client';

export default function BillingPreview({ user, onNavigateRates }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const currency = report?.rates?.currency || 'IDR';

  const formatPrice = (val) => {
    if (val === undefined || val === null) val = 0;
    if (currency === 'IDR') {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
  };

  const formatPriceDetail = (val) => {
    if (val === undefined || val === null) val = 0;
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
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isAdmin ? 'Laporan Billing Virtual Machine' : 'Billing & Biaya VM Saya'}
            </h1>
            <span style={{ 
              fontSize: '0.8rem', 
              background: isAdmin ? '#eff6ff' : '#ecfdf5', 
              color: isAdmin ? '#1e3a8a' : '#065f46', 
              border: isAdmin ? '1px solid #bfdbfe' : '1px solid #a7f3d0', 
              padding: '3px 10px', 
              borderRadius: '6px', 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {isAdmin ? <ShieldCheck size={14} /> : <UserCheck size={14} />}
              {isAdmin ? 'Seluruh Infrastruktur' : `User: ${user?.username || 'Operator'}`}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            {isAdmin 
              ? 'Rincian akumulasi biaya komputasi, storage, dan network untuk seluruh virtual machine yang aktif dan teralokasi.' 
              : 'Rincian tagihan pemakaian resource komputasi untuk Virtual Machine yang secara resmi ditugaskan kepada akun Anda.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin && onNavigateRates && (
            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={onNavigateRates}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sliders size={14} />
              <span>Atur Tarif Billing</span>
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

      {/* Active Rate Banner */}
      {report?.rates && (
        <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: '24px', background: '#f8fafc', borderLeft: '4px solid var(--ocean-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={18} style={{ color: 'var(--ocean-blue)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Tarif Unit Aktif ({currency}):
              </span>
            </div>

            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
              <span style={{ color: '#1e3a8a', fontWeight: 600 }}>
                vCPU: <strong>{formatPriceDetail(report.rates.cpu_rate_hourly)}</strong>/jam ({formatPrice(report.rates.cpu_rate_hourly * 720)}/bln)
              </span>
              <span style={{ color: '#059669', fontWeight: 600 }}>
                RAM: <strong>{formatPriceDetail(report.rates.ram_rate_hourly)}</strong>/GB/jam ({formatPrice(report.rates.ram_rate_hourly * 720)}/bln)
              </span>
              <span style={{ color: '#b45309', fontWeight: 600 }}>
                Storage: <strong>{formatPriceDetail(report.rates.storage_rate_hourly)}</strong>/GB/jam ({formatPrice(report.rates.storage_rate_hourly * 720)}/bln)
              </span>
              <span style={{ color: '#7c3aed', fontWeight: 600 }}>
                Network: <strong>{formatPriceDetail(report.rates.network_rate_hourly)}</strong>/IP/jam ({formatPrice(report.rates.network_rate_hourly * 720)}/bln)
              </span>
            </div>

            {isAdmin && onNavigateRates && (
              <button
                type="button"
                onClick={onNavigateRates}
                style={{ background: 'transparent', border: 'none', color: 'var(--ocean-blue)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Ubah Tarif</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        {/* Total VMs */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              {isAdmin ? 'Total Virtual Machine' : 'VM Ditugaskan'}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a' }}>
              <Server size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {loading ? '...' : (report?.total_vms || 0)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>VM</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '4px' }}>
            Alokasi aktif di hypervisor
          </div>
        </div>

        {/* Total vCPU */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Total vCPU Cores
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e3a8a' }}>
              <Cpu size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {loading ? '...' : (report?.total_cpu_cores || 0)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>vCPU</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            RAM: {report?.total_ram_gb || 0} GB
          </div>
        </div>

        {/* Total Storage */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Storage Terpakai
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <HardDrive size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {loading ? '...' : (report?.total_disk_gb || 0)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>GB</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Penyimpanan virtual disk NVMe/SAN
          </div>
        </div>

        {/* Total Cost */}
        <div className="glass-panel" style={{ padding: '20px', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#1e3a8a', fontWeight: 800, textTransform: 'uppercase' }}>
              {isAdmin ? 'Total Biaya Keseluruhan' : 'Total Tagihan Saya'}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {loading ? '...' : formatPrice(report?.total_monthly || 0)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Estimasi: ~{formatPriceDetail(report?.total_hourly || 0)} / jam
          </div>
        </div>
      </div>

      {/* VM Billing Itemized Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isAdmin ? 'Rincian Billing Seluruh Virtual Machine' : 'Rincian Tagihan Per Virtual Machine'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Kalkulasi biaya berbasis pemakaian spesifikasi CPU, RAM, Storage, dan Alamat IP
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Menghitung kalkulasi billing...
          </div>
        ) : !report?.vms || report.vms.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <FileText size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
              {isAdmin ? 'Belum Ada Virtual Machine' : 'Belum Ada VM yang Di-assign ke Anda'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: '440px', margin: '0 auto' }}>
              {isAdmin 
                ? 'Deploy virtual machine baru melalui menu Virtual Machines untuk mulai menghasilkan data billing.'
                : 'Akun Anda belum memiliki virtual machine yang ditugaskan. Silakan hubungi Administrator untuk mendapatkan alokasi VM.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Nama Virtual Machine</th>
                  {isAdmin && <th style={{ padding: '10px 12px' }}>User Penugasan</th>}
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Biaya CPU</th>
                  <th style={{ padding: '10px 12px' }}>Biaya RAM</th>
                  <th style={{ padding: '10px 12px' }}>Biaya Storage</th>
                  <th style={{ padding: '10px 12px' }}>Biaya Network</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total / Bulan</th>
                </tr>
              </thead>
              <tbody>
                {report.vms.map((vm) => (
                  <tr key={vm.vm_id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                    {/* VM Name & Node */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{vm.vm_name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {vm.node_name} • {vm.cluster_name}
                      </div>
                    </td>

                    {/* Assigned User (Admin only) */}
                    {isAdmin && (
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          background: vm.assigned_user_name === 'Unassigned' ? '#fffbeb' : '#f1f5f9',
                          color: vm.assigned_user_name === 'Unassigned' ? '#b45309' : '#0f172a',
                          padding: '3px 8px', 
                          borderRadius: '6px',
                          fontWeight: 600,
                          border: '1px solid #cbd5e1'
                        }}>
                          {vm.assigned_user_name}
                        </span>
                      </td>
                    )}

                    {/* Status */}
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 700,
                        background: vm.status === 'RUNNING' ? '#ecfdf5' : '#f1f5f9',
                        color: vm.status === 'RUNNING' ? '#059669' : '#64748b',
                        border: vm.status === 'RUNNING' ? '1px solid #a7f3d0' : '1px solid #cbd5e1'
                      }}>
                        {vm.status}
                      </span>
                    </td>

                    {/* CPU Cost */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatPrice(vm.cpu_cost_hourly * 720)}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {vm.cpu_cores} vCPU • ~{formatPriceDetail(vm.cpu_cost_hourly)}/jam
                      </div>
                    </td>

                    {/* RAM Cost */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatPrice(vm.ram_cost_hourly * 720)}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {(vm.ram_mb / 1024).toFixed(1)} GB • ~{formatPriceDetail(vm.ram_cost_hourly)}/jam
                      </div>
                    </td>

                    {/* Storage Cost */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatPrice(vm.storage_cost_hourly * 720)}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {vm.disk_gb} GB • ~{formatPriceDetail(vm.storage_cost_hourly)}/jam
                      </div>
                    </td>

                    {/* Network Cost */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatPrice(vm.network_cost_hourly * 720)}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {vm.ip_address || 'Virtual NIC'}
                      </div>
                    </td>

                    {/* Total Monthly */}
                    <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>
                        {formatPrice(vm.total_monthly)}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        ~{formatPriceDetail(vm.total_hourly)} / jam
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
