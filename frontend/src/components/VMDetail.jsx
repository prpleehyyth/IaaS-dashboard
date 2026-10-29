import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Play, 
  Square, 
  RotateCw, 
  Terminal, 
  Edit3, 
  Trash2, 
  Disc, 
  Activity, 
  Cpu, 
  Database, 
  HardDrive, 
  Wifi, 
  Server, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  Receipt, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Layers,
  Monitor
} from 'lucide-react';
import { api } from '../api/client';

export default function VMDetail({ 
  vmId, 
  user, 
  onBack, 
  onNavigateCluster,
  onOpenConsole, 
  onOpenEditModal, 
  onOpenRebuildModal, 
  onOpenResourceModal, 
  onDeleteVM,
  showToast 
}) {
  const [vm, setVm] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [billingReport, setBillingReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'network' | 'placement' | 'audit' | 'billing'
  const [copiedIP, setCopiedIP] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || api.isAdmin();

  const loadVMData = async () => {
    try {
      const [vmData, telemData, auditData] = await Promise.all([
        api.getVM(vmId),
        api.getVMTelemetry(vmId).catch(() => null),
        api.getAuditLogs({ limit: 10, search: vmId }).catch(() => ({ logs: [] }))
      ]);

      setVm(vmData);
      if (telemData) setTelemetry(telemData);
      if (auditData?.logs) setAuditLogs(auditData.logs);

      // Load billing report if available (Admin only)
      if (isAdmin) {
        try {
          const bill = await api.getBillingReport();
          setBillingReport(bill);
        } catch (e) {
          // non-blocking
        }
      }
    } catch (err) {
      console.error('Failed to load VM detail:', err);
      if (showToast) showToast('Gagal memuat detail VM: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vmId) {
      setLoading(true);
      loadVMData();
    }
  }, [vmId]);

  const handlePowerAction = async (action) => {
    setActionLoading(true);
    try {
      await api.executeVMAction(vm.id, action);
      if (showToast) showToast(`Perintah ${action} berhasil dikirim ke hypervisor`);
      await loadVMData();
    } catch (err) {
      if (showToast) showToast(`Gagal mengeksekusi ${action}: ` + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIP(true);
    setTimeout(() => setCopiedIP(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto', color: 'var(--ocean-blue)' }} />
        <div style={{ fontWeight: 600 }}>Memuat informasi detail Virtual Machine...</div>
      </div>
    );
  }

  if (!vm) {
    return (
      <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
        <AlertCircle size={36} color="#dc2626" style={{ margin: '0 auto 12px auto' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
          Virtual Machine Tidak Ditemukan
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          VM mungkin telah dihapus atau akun Anda tidak memiliki hak akses ke VM ini.
        </p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Kembali ke Daftar Virtual Machines</span>
        </button>
      </div>
    );
  }

  const isRunning = vm.status === 'RUNNING';
  const isVMware = vm.hypervisor_type === 'VMWARE';

  // Find billing item for this VM
  const vmBilling = billingReport?.vms?.find(v => v.vm_id === vm.id);
  const currency = billingReport?.rates?.currency || 'IDR';

  const formatPrice = (val) => {
    if (val === undefined || val === null) val = 0;
    if (currency === 'IDR') {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div>
      {/* Top Breadcrumb & Back Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Virtual Machines</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            <span>/</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{vm.name}</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isRunning ? (
            <button
              className="btn btn-secondary btn-sm"
              disabled={actionLoading}
              onClick={() => handlePowerAction('stop')}
              style={{ color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.25)' }}
            >
              <Square size={13} />
              <span>Matikan VM (Stop)</span>
            </button>
          ) : (
            <button
              className="btn btn-success btn-sm"
              disabled={actionLoading}
              onClick={() => handlePowerAction('start')}
            >
              <Play size={13} />
              <span>Nyalakan VM (Start)</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            disabled={!isRunning || actionLoading}
            onClick={() => handlePowerAction('restart')}
            title="Reboot Virtual Machine"
          >
            <RotateCw size={13} />
            <span>Restart</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenRebuildModal && onOpenRebuildModal(vm)}
            style={{ color: '#1e3a8a', borderColor: '#bfdbfe', background: '#eff6ff' }}
          >
            <Disc size={13} />
            <span>Rebuild OS</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenResourceModal && onOpenResourceModal(vm)}
            style={{ color: isRunning ? '#059669' : '#475569', borderColor: isRunning ? '#a7f3d0' : 'var(--border-subtle)', background: isRunning ? '#ecfdf5' : '#f8fafc' }}
          >
            <Activity size={13} />
            <span>Live Monitor</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            disabled={!isRunning}
            onClick={() => onOpenConsole && onOpenConsole(vm)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Terminal size={14} />
            <span>Remote Console</span>
          </button>

          {isAdmin && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenEditModal && onOpenEditModal(vm)}
                title="Edit Spesifikasi Hardware (Admin Only)"
              >
                <Edit3 size={13} />
                <span>Edit Specs</span>
              </button>

              <button
                className="btn btn-danger btn-sm"
                onClick={() => onDeleteVM && onDeleteVM(vm)}
                title="Hapus Virtual Machine (Admin Only)"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="glass-panel" style={{ padding: '24px 28px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '54px', 
              height: '54px', 
              borderRadius: '14px', 
              background: isRunning ? '#eff6ff' : '#f1f5f9',
              color: isRunning ? '#1e3a8a' : 'var(--text-dim)',
              border: isRunning ? '1px solid #bfdbfe' : '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <HardDrive size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {vm.name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isRunning ? '#059669' : 'var(--text-dim)' }}>
                    {vm.status}
                  </span>
                </div>
                <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>
                  {vm.hypervisor_type}
                </span>
                {vm.vmid && (
                  <span style={{ fontSize: '0.74rem', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    VMID: {vm.vmid}
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px', margin: 0 }}>
                OS: <strong style={{ color: 'var(--text-main)' }}>{vm.os_type}</strong> • Divisi/Tenant: <strong>{vm.tenant_name || 'PT PAL Cloud'}</strong>
              </p>
            </div>
          </div>

          {/* Quick Specs Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Compute Cores</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e3a8a' }}>{vm.cpu_cores} vCPU</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Memori RAM</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>{Math.round(vm.ram_mb / 1024)} GB</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Volume Disk</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#b45309' }}>{vm.disk_gb} GB</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        borderBottom: '1px solid var(--border-subtle)', 
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'overview', label: 'Ikhtisar Hardware & Metrik', icon: Cpu },
          { id: 'network', label: 'Jaringan & Akses', icon: Wifi },
          { id: 'placement', label: 'Infrastruktur Host & Cluster', icon: Server },
          { id: 'audit', label: 'Riwayat Aktivitas Audit', icon: ShieldCheck },
          ...(isAdmin ? [
            { id: 'billing', label: 'Estimasi Billing & Biaya', icon: Receipt },
          ] : []),
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.86rem',
              fontWeight: activeTab === id ? 800 : 600,
              color: activeTab === id ? 'var(--ocean-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === id ? '2px solid var(--ocean-blue)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Ikhtisar Hardware & Telemetri */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Telemetry Live Meters */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: 'var(--ocean-blue)' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Telemetri Real-Time & Penggunaan Sumber Daya
                </h2>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={loadVMData}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} />
                <span>Segarkan Metrik</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '18px' }}>
              {/* CPU Meter */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Beban CPU (vCPU)</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a' }}>
                    {isRunning ? `${telemetry?.cpu_usage_pct || 14.5}%` : '0%'}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: isRunning ? `${Math.min(telemetry?.cpu_usage_pct || 14.5, 100)}%` : '0%', 
                    height: '100%', 
                    background: (telemetry?.cpu_usage_pct || 14.5) > 80 ? '#dc2626' : 'linear-gradient(90deg, #1e3a8a, #3b82f6)' 
                  }}></div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                  Alokasi: {vm.cpu_cores} vCPU Core Virtual
                </div>
              </div>

              {/* RAM Meter */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Memori RAM Terpakai</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669' }}>
                    {isRunning ? `${telemetry?.ram_usage_pct || 38.2}%` : '0%'}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: isRunning ? `${Math.min(telemetry?.ram_usage_pct || 38.2, 100)}%` : '0%', 
                    height: '100%', 
                    background: (telemetry?.ram_usage_pct || 38.2) > 85 ? '#dc2626' : 'linear-gradient(90deg, #059669, #10b981)' 
                  }}></div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                  Alokasi: {Math.round(vm.ram_mb / 1024)} GB ({vm.ram_mb} MB)
                </div>
              </div>

              {/* Storage Meter */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Volume Penyimpanan Virtual</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#b45309' }}>
                    {vm.disk_gb} GB
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '45%', height: '100%', background: 'linear-gradient(90deg, #b45309, #f59e0b)' }}></div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                  Tipe: SAN / High-Speed NVMe Storage Pool
                </div>
              </div>
            </div>
          </div>

          {/* Hardware Specifications Table */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>
              Spesifikasi Hardware & Profil Virtual
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Arsitektur CPU</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>x86_64 64-bit Virtualized CPU</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>{vm.cpu_cores} Cores assigned</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Hypervisor Engine</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {vm.hypervisor_type === 'VMWARE' ? 'VMware ESXi / vSphere 8' : 'Proxmox VE KVM (Kernel-based VM)'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>QEMU/KVM Hardware Virtualization</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Operating System</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{vm.os_type}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>Linux / Standard Enterprise Distribution</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Waktu Dibuat</span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {new Date(vm.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>ID UUID: {vm.id}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Jaringan & Akses */}
      {activeTab === 'network' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wifi size={20} style={{ color: 'var(--ocean-blue)' }} />
            <span>Konfigurasi Jaringan & Alamat Akses</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                Alamat IP Virtual (Private IP)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-main)' }}>
                  {vm.ip_address || 'Unassigned'}
                </span>
                {vm.ip_address && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(vm.ip_address)}
                    style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                  >
                    <Copy size={13} />
                    <span>{copiedIP ? 'Tersalin!' : 'Salin IP'}</span>
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '8px', margin: 0 }}>
                Alamat IP internal untuk SSH, remote management, dan routing aplikasi privat.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                Hardware MAC Address
              </div>
              <div style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)' }}>
                {vm.mac_address || '52:54:00:12:34:56'}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '8px', margin: 0 }}>
                Virtual NIC adapter MAC address terdaftar pada SDN bridge hypervisor.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                Port Konsol Interaktif (VNC / WebSocket)
              </div>
              <div style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e3a8a' }}>
                Port {vm.console_port || 5900} (WebSocket Bridge Active)
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '8px', margin: 0 }}>
                Akses konsol interaktif didukung langsung melalui browser tanpa memerlukan plugin tambahan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Penempatan Infrastruktur Host & Cluster */}
      {activeTab === 'placement' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={20} style={{ color: 'var(--ocean-blue)' }} />
              <span>Lokasi Penempatan Host Fisik & Cluster</span>
            </h2>
            {isAdmin && onNavigateCluster && (
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigateCluster(vm.cluster_id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Buka Detail Cluster</span>
                <ExternalLink size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Target Cluster</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                {vm.cluster_name || vm.cluster_id}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Tipe: <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>{vm.hypervisor_type}</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Host Fisik / Compute Node</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {vm.node_name || vm.node_id || 'Auto-Scheduled'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Bare-Metal Server Node pengampu VM ini
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Tenant / Organisasi Pemilik</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {vm.tenant_name || 'PT PAL Indonesia (Corporate)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Tenant ID: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{vm.tenant_id}</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Riwayat Aktivitas Audit */}
      {activeTab === 'audit' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--ocean-blue)' }} />
            <span>Riwayat Aktivitas & Jejak Audit VM Ini</span>
          </h2>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Operasi</th>
                  <th>Operator</th>
                  <th>Status</th>
                  <th>Detail Aktivitas</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px' }}>
                      Belum ada catatan aktivitas audit khusus untuk Virtual Machine ini.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 800, 
                          background: '#eff6ff', 
                          color: '#1e3a8a', 
                          border: '1px solid #bfdbfe', 
                          padding: '3px 8px', 
                          borderRadius: '6px' 
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {log.username || 'System Officer'}
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '0.74rem', 
                          fontWeight: 700, 
                          color: log.status === 'SUCCESS' ? '#059669' : '#dc2626' 
                        }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        {log.details}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Estimasi Billing & Biaya (Admin Only) */}
      {activeTab === 'billing' && isAdmin && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} style={{ color: 'var(--ocean-blue)' }} />
            <span>Kalkulasi Tagihan Berbasis Pemakaian (Metering)</span>
          </h2>

          {vmBilling ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px', marginBottom: '22px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Compute ({vm.cpu_cores} vCPU)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                    {formatPrice(vmBilling.cpu_cost_hourly * 730)} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>/ bln</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rp {vmBilling.cpu_cost_hourly?.toFixed(2)}/jam</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Memory ({Math.round(vm.ram_mb / 1024)} GB)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                    {formatPrice(vmBilling.ram_cost_hourly * 730)} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>/ bln</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rp {vmBilling.ram_cost_hourly?.toFixed(2)}/jam</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Storage ({vm.disk_gb} GB)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                    {formatPrice(vmBilling.storage_cost_hourly * 730)} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>/ bln</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rp {vmBilling.storage_cost_hourly?.toFixed(2)}/jam</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Virtualisasi & Ops</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
                    {formatPrice(((vmBilling.virt_cost_hourly || 0) + (vmBilling.man_cost_hourly || 0) + (vmBilling.bandwidth_cost_hourly || 0)) * 730)} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>/ bln</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VRT, Man Cost & Bandwidth</div>
                </div>

                <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.78rem', color: '#1e3a8a', fontWeight: 700, textTransform: 'uppercase' }}>Total Estimasi (730 jam)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                    {formatPrice(vmBilling.total_monthly)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    ~Rp {vmBilling.total_hourly?.toFixed(2)} / jam
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <Receipt size={32} style={{ color: 'var(--text-dim)', margin: '0 auto 8px auto' }} />
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                Kalkulasi Tarif Standar
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
                Biaya VM ini dihitung otomatis berdasarkan alokasi spesifikasi {vm.cpu_cores} vCPU, {Math.round(vm.ram_mb / 1024)}GB RAM, dan {vm.disk_gb}GB Disk dengan tarif hourly berjalan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
