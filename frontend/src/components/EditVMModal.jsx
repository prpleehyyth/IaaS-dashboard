import React, { useState } from 'react';
import { X, Cpu, Database, HardDrive, AlertCircle, Shield } from 'lucide-react';
import { calculateBackupAddonCost, formatCurrencyIDR } from '../constants/pricingCatalog';

export default function EditVMModal({ vm, onClose, onUpdate }) {
  const [name, setName] = useState(vm.name);
  const [cpuCores, setCpuCores] = useState(vm.cpu_cores);
  const [ramGB, setRamGB] = useState(Math.round(vm.ram_mb / 1024));
  const [diskGB, setDiskGB] = useState(vm.disk_gb);
  const [backupMode, setBackupMode] = useState(vm.backup_mode || 'NONE');
  const [backupProvider, setBackupProvider] = useState(
    vm.backup_provider && vm.backup_provider !== 'NONE'
      ? vm.backup_provider
      : (vm.hypervisor_type === 'VMWARE' ? 'NETAPP' : 'PBS')
  );
  const [backupQuotaGB, setBackupQuotaGB] = useState(vm.backup_quota_gb > 0 ? vm.backup_quota_gb : vm.disk_gb);
  const [backupSchedule, setBackupSchedule] = useState(vm.backup_schedule && vm.backup_schedule !== 'NONE' ? vm.backup_schedule : 'DAILY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isVMware = vm.hypervisor_type === 'VMWARE';
  const engineName = !isVMware
    ? 'Proxmox Backup Server (PBS)'
    : (backupProvider === 'VEEAM' ? 'Veeam Backup & Replication (VUL)' : 'NetApp ONTAP / SnapCenter');
  const backupCalc = calculateBackupAddonCost('TIER_1', vm.hypervisor_type, backupMode, parseInt(backupQuotaGB, 10) || diskGB, parseInt(diskGB, 10), backupProvider);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setIsSubmitting(true);
    try {
      await onUpdate(vm.id, {
        name: name.trim(),
        cpu_cores: parseInt(cpuCores, 10),
        ram_mb: parseInt(ramGB, 10) * 1024,
        disk_gb: parseInt(diskGB, 10),
        backup_mode: backupMode,
        backup_provider: backupMode === 'NONE' ? 'NONE' : (isVMware ? backupProvider : 'PBS'),
        backup_quota_gb: backupMode === 'NONE' ? 0 : parseInt(backupQuotaGB, 10) || parseInt(diskGB, 10),
        backup_schedule: backupMode === 'NONE' ? 'NONE' : backupSchedule,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update virtual machine specs');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Ubah Spesifikasi & Add-On Backup VM</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Atur ulang vCPU, Memory, Storage, dan Add-On Backup ({engineName}) untuk {vm.name}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nama Virtual Machine</label>
              <input 
                type="text" 
                className="form-input" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Spec Sliders */}
            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
              {/* CPU Cores */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>vCPU Compute Cores:</span>
                  <span style={{ color: '#1e3a8a', fontWeight: 700 }}>{cpuCores} vCPU</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="32" 
                  value={cpuCores} 
                  onChange={(e) => setCpuCores(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--ocean-blue)' }}
                />
              </div>

              {/* RAM (GB) */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>RAM Allocation:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{ramGB} GB ({ramGB * 1024} MB)</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="64" 
                  value={ramGB} 
                  onChange={(e) => setRamGB(e.target.value)}
                  style={{ width: '100%', accentColor: '#1e3a8a' }}
                />
              </div>

              {/* Disk (GB) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Disk Capacity:</span>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>{diskGB} GB</span>
                </div>
                <input 
                  type="range" 
                  min={vm.disk_gb}
                  max="500" 
                  step="10"
                  value={diskGB} 
                  onChange={(e) => {
                    setDiskGB(e.target.value);
                    if (backupQuotaGB < parseInt(e.target.value, 10)) {
                      setBackupQuotaGB(parseInt(e.target.value, 10));
                    }
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                />
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  * Hypervisor allows dynamic disk expansion (cannot shrink below current {vm.disk_gb} GB).
                </div>
              </div>
            </div>

            {/* Backup Add-On Section */}
            <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color={isVMware ? '#0284c7' : '#c2410c'} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Add-On Backup &amp; Disaster Recovery
                  </span>
                </div>
                <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'} style={{ fontSize: '0.7rem' }}>
                  {isVMware ? (backupProvider === 'VEEAM' ? 'VMware • Veeam B&R' : 'VMware • NetApp ONTAP') : 'Proxmox • PBS'}
                </span>
              </div>

              {isVMware && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setBackupProvider('NETAPP')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: backupProvider === 'NETAPP' ? '2px solid #0284c7' : '1px solid var(--border-subtle)',
                      background: backupProvider === 'NETAPP' ? '#f0f9ff' : '#ffffff',
                      color: backupProvider === 'NETAPP' ? '#0284c7' : 'var(--text-muted)',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    NetApp ONTAP / SnapCenter
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupProvider('VEEAM')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: backupProvider === 'VEEAM' ? '2px solid #059669' : '1px solid var(--border-subtle)',
                      background: backupProvider === 'VEEAM' ? '#ecfdf5' : '#ffffff',
                      color: backupProvider === 'VEEAM' ? '#059669' : 'var(--text-muted)',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Veeam Backup &amp; Replication
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: backupMode !== 'NONE' ? '12px' : 0 }}>
                {[
                  { id: 'NONE', label: 'Tanpa Backup', sub: 'Manual / Off' },
                  { id: 'WARM', label: 'Warm Backup', sub: isVMware ? (backupProvider === 'VEEAM' ? 'Veeam CBT Live' : 'NetApp Live Snap') : 'PBS Snapshot (Live)' },
                  { id: 'COLD', label: 'Cold Backup', sub: isVMware ? (backupProvider === 'VEEAM' ? 'Veeam Archive' : 'NetApp SnapVault') : 'PBS Stop Archive' }
                ].map(opt => {
                  const active = backupMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setBackupMode(opt.id);
                        if (opt.id === 'WARM') setBackupSchedule('DAILY');
                        if (opt.id === 'COLD') setBackupSchedule('WEEKLY');
                      }}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: active ? '2px solid #1e3a8a' : '1px solid var(--border-subtle)',
                        background: active ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: active ? '#1e3a8a' : 'var(--text-main)' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {opt.sub}
                      </div>
                    </button>
                  );
                })}
              </div>

              {backupMode !== 'NONE' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>Kuota Repository Backup (GB)</label>
                    <input
                      type="number"
                      min={diskGB}
                      max="2000"
                      step="10"
                      className="form-input"
                      value={backupQuotaGB}
                      onChange={(e) => setBackupQuotaGB(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>Jadwal Otomatis</label>
                    <select
                      className="form-select"
                      value={backupSchedule}
                      onChange={(e) => setBackupSchedule(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                    >
                      <option value="DAILY">Harian (Daily Snapshot)</option>
                      <option value="WEEKLY">Mingguan (Weekly Archive)</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1', fontSize: '0.76rem', color: '#059669', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Engine: {engineName} ({backupMode})</span>
                    <span>+{formatCurrencyIDR(backupCalc.totalMonthly)}/bln</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Apply Reconfiguration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
