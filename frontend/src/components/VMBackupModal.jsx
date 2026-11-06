import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Database,
  Shield,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  RefreshCw,
  Flame,
  Snowflake,
  Server
} from 'lucide-react';
import { api } from '../api/client';

export default function VMBackupModal({ vm, user, onClose, onBackupSuccess, showToast }) {
  const isVMware = vm?.hypervisor_type === 'VMWARE';
  const defaultProvider = vm?.backup_provider && vm.backup_provider !== 'NONE'
    ? vm.backup_provider
    : (isVMware ? 'NETAPP' : 'PBS');
  const defaultMode = vm?.backup_mode && vm.backup_mode !== 'NONE'
    ? vm.backup_mode
    : 'WARM';

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmRestoreBackup, setConfirmRestoreBackup] = useState(null);
  const [startAfterRestore, setStartAfterRestore] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Create Backup Form State
  const [selectedMode, setSelectedMode] = useState(defaultMode);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const loadBackups = useCallback(async () => {
    if (!vm?.id) return;
    setLoading(true);
    try {
      const list = await api.getVMBackups(vm.id);
      setBackups(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar snapshot backup');
    } finally {
      setLoading(false);
    }
  }, [vm?.id]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleCreateBackup = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setCreatingBackup(true);
    try {
      const provider = isVMware ? selectedProvider : 'PBS';
      const res = await api.triggerVMBackup(vm.id, {
        backup_mode: selectedMode,
        backup_provider: provider,
        notes: notes.trim(),
      });
      setNotes('');
      if (showToast) {
        showToast(res.message || `Backup ${selectedMode} (${provider}) berhasil dibuat untuk '${vm.name}'`);
      }
      await loadBackups();
      if (onBackupSuccess) onBackupSuccess(res);
    } catch (err) {
      setError(err.message || 'Gagal membuat backup baru');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestoreBackup) return;
    setError('');
    setRestoringId(confirmRestoreBackup.id);
    try {
      const res = await api.restoreVMBackup(vm.id, confirmRestoreBackup.id, {
        start_after: startAfterRestore,
      });
      if (showToast) {
        showToast(res.message || `VM '${vm.name}' berhasil di-restore dari snapshot '${confirmRestoreBackup.snapshot_name}'`);
      }
      setConfirmRestoreBackup(null);
      await loadBackups();
      if (onBackupSuccess) onBackupSuccess(res);
    } catch (err) {
      setError(err.message || 'Gagal melakukan restore VM dari backup');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteBackup = async (backup) => {
    if (!window.confirm(`Hapus snapshot backup '${backup.snapshot_name}'?`)) return;
    setDeletingId(backup.id);
    setError('');
    try {
      await api.deleteVMBackup(vm.id, backup.id);
      if (showToast) {
        showToast(`Snapshot backup '${backup.snapshot_name}' berhasil dihapus`);
      }
      await loadBackups();
      if (onBackupSuccess) onBackupSuccess();
    } catch (err) {
      setError(err.message || 'Gagal menghapus snapshot backup');
    } finally {
      setDeletingId(null);
    }
  };

  const getProviderBadgeLabel = (prov) => {
    const p = (prov || '').toUpperCase();
    if (p === 'VEEAM') return 'VMware • Veeam Backup & Replication';
    if (p === 'NETAPP') return 'VMware • NetApp ONTAP SnapCenter';
    return 'Proxmox • Proxmox Backup Server (PBS)';
  };

  const hasAddon = vm?.backup_mode === 'WARM' || vm?.backup_mode === 'COLD';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '880px', maxHeight: '92vh' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 24px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{
                background: isVMware ? 'linear-gradient(135deg, #0284c7 0%, #059669 100%)' : 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
                color: '#ffffff',
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.18)'
              }}>
                <Database size={18} />
              </div>
              <h2 style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Backup &amp; Restore Center — {vm.name}
              </h2>
              <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>
                {vm.hypervisor_type}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '44px' }}>
              {isVMware
                ? 'vCenter Backup & Disaster Recovery via NetApp ONTAP SnapCenter & Veeam Backup & Replication (Warm & Cold)'
                : 'Proxmox VE Backup & Disaster Recovery via Proxmox Backup Server / PBS (Warm Live Snapshot & Cold Archive)'}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '10px 14px',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.84rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Add-On Status Summary Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '12px',
            marginBottom: '18px'
          }}>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Status Add-On VM
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: hasAddon ? '#059669' : '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={15} />
                <span>{hasAddon ? `Add-On Aktif (${vm.backup_mode})` : 'Mode Manual / On-Demand'}</span>
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Jadwal: {vm.backup_schedule && vm.backup_schedule !== 'NONE' ? vm.backup_schedule : 'Manual Trigger'}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Backup Engine
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
                {!isVMware
                  ? 'Proxmox PBS'
                  : (selectedProvider === 'VEEAM' ? 'Veeam B&R (VUL)' : 'NetApp ONTAP')}
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                {!isVMware ? 'Zstd + SHA-256 Deduplication' : (selectedProvider === 'VEEAM' ? 'vSphere CBT + Instant Recovery' : 'SnapCenter + SnapMirror/Vault')}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Kuota &amp; Snapshot Tersedia
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                {backups.length} Restore Point
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Kuota: {vm.backup_quota_gb || vm.disk_gb} GB (Disk VM: {vm.disk_gb} GB)
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Backup Terakhir
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {backups[0]?.created_at
                  ? new Date(backups[0].created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                  : (vm.last_backup_at ? new Date(vm.last_backup_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum ada snapshot')}
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Oleh: {backups[0]?.created_by_name || (user?.username || 'Operator')}
              </div>
            </div>
          </div>

          {/* Create New Backup Section */}
          <form onSubmit={handleCreateBackup} style={{
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px 18px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} color="#1e3a8a" />
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Buat Snapshot Backup Baru (Warm / Cold)
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {getProviderBadgeLabel(isVMware ? selectedProvider : 'PBS')}
              </span>
            </div>

            {/* If VMware vCenter: Allow selecting between NetApp ONTAP and Veeam B&R */}
            {isVMware && (
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                  Pilih Engine Backup vCenter (NetApp ONTAP / Veeam B&amp;R):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('NETAPP')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '9px',
                      border: selectedProvider === 'NETAPP' ? '2px solid #0284c7' : '1px solid var(--border-subtle)',
                      background: selectedProvider === 'NETAPP' ? '#f0f9ff' : '#ffffff',
                      color: selectedProvider === 'NETAPP' ? '#0284c7' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>NetApp ONTAP / SnapCenter</div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Storage-level SAN/NAS Snapshot, SnapMirror (Warm) &amp; SnapVault (Cold)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProvider('VEEAM')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '9px',
                      border: selectedProvider === 'VEEAM' ? '2px solid #059669' : '1px solid var(--border-subtle)',
                      background: selectedProvider === 'VEEAM' ? '#ecfdf5' : '#ffffff',
                      color: selectedProvider === 'VEEAM' ? '#059669' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>Veeam Backup &amp; Replication</div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      vSphere Changed Block Tracking (CBT), Instant VM Recovery &amp; SOBR Archive
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Warm vs Cold Mode Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedMode('WARM')}
                style={{
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: selectedMode === 'WARM' ? '2px solid #d97706' : '1px solid var(--border-subtle)',
                  background: selectedMode === 'WARM' ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <Flame size={18} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: selectedMode === 'WARM' ? '#b45309' : 'var(--text-main)' }}>
                    Warm Backup (Live Online Snapshot)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                    {isVMware
                      ? (selectedProvider === 'VEEAM'
                        ? 'Backup saat VM menyala via vSphere CBT tanpa downtime (Instant Recovery Ready).'
                        : 'Snapshot online via NetApp SnapCenter + SnapMirror tanpa mematikan VM.')
                      : 'Backup online via Proxmox Backup Server (mode=snapshot dirty-bitmap) tanpa downtime.'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('COLD')}
                style={{
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: selectedMode === 'COLD' ? '2px solid #0284c7' : '1px solid var(--border-subtle)',
                  background: selectedMode === 'COLD' ? '#f0f9ff' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <Snowflake size={18} color="#0284c7" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: selectedMode === 'COLD' ? '#0369a1' : 'var(--text-main)' }}>
                    Cold Backup (Offline Consistent Archive)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                    {isVMware
                      ? (selectedProvider === 'VEEAM'
                        ? 'Full consistent archive (.vbk) ke Veeam Scale-Out Repository untuk retensi jangka panjang.'
                        : 'Quiesced/offline consistent volume backup ke NetApp SnapVault Cold Storage.')
                      : 'Consistent stop-mode backup terkompresi penuh Zstd ke Proxmox Backup Server (PBS).'}
                  </div>
                </div>
              </button>
            </div>

            {/* Notes & Submit */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Catatan backup opsional (misal: Sebelum update patch OS / DB)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ flex: 1, minWidth: '220px', padding: '8px 12px', fontSize: '0.84rem' }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creatingBackup}
                style={{ padding: '9px 18px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}
              >
                {creatingBackup ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Memproses Backup...</span>
                  </>
                ) : (
                  <>
                    <Database size={14} />
                    <span>Jalankan {selectedMode} Backup ({isVMware ? selectedProvider : 'PBS'})</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Restore Confirmation Banner */}
          {confirmRestoreBackup && (
            <div style={{
              background: '#fffbeb',
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '16px 18px',
              marginBottom: '18px',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 800, fontSize: '0.95rem' }}>
                    <RotateCcw size={18} />
                    <span>Konfirmasi Restore Virtual Machine — {vm.name}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#78350f', margin: '6px 0 10px 0' }}>
                    Anda akan mengembalikan state disk &amp; konfigurasi VM <strong>{vm.name}</strong> ke titik backup{' '}
                    <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      {confirmRestoreBackup.snapshot_name}
                    </code>{' '}
                    ({confirmRestoreBackup.backup_provider} • {confirmRestoreBackup.backup_mode} Backup dari{' '}
                    {new Date(confirmRestoreBackup.created_at).toLocaleString('id-ID')}).
                  </p>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#92400e' }}>
                    <input
                      type="checkbox"
                      checked={startAfterRestore}
                      onChange={(e) => setStartAfterRestore(e.target.checked)}
                      style={{ accentColor: '#d97706', width: '15px', height: '15px' }}
                    />
                    <span>Nyalakan VM otomatis setelah proses Restore selesai (Auto-Start VM)</span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirmRestoreBackup(null)}
                    disabled={restoringId !== null}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleConfirmRestore}
                    disabled={restoringId !== null}
                    style={{ background: '#d97706', borderColor: '#b45309' }}
                  >
                    {restoringId === confirmRestoreBackup.id ? (
                      <>
                        <RefreshCw size={13} className="spin" />
                        <span>Restoring VM...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={13} />
                        <span>Ya, Restore Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Backups Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Daftar Restore Point &amp; Riwayat Backup ({backups.length})
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadBackups}
                disabled={loading}
                style={{ padding: '5px 10px', fontSize: '0.76rem' }}
              >
                <RefreshCw size={12} className={loading ? 'spin' : ''} />
                <span>Segarkan</span>
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Snapshot / Archive ID</th>
                    <th>Mode &amp; Engine</th>
                    <th>Storage Repository &amp; Ukuran</th>
                    <th>Waktu Dibuat</th>
                    <th style={{ textAlign: 'right' }}>Aksi Restore</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        Memuat daftar backup...
                      </td>
                    </tr>
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                        <Database size={30} color="var(--text-dim)" style={{ margin: '0 auto 8px auto' }} />
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                          Belum Ada Snapshot Backup untuk VM Ini
                        </div>
                        <div style={{ fontSize: '0.8rem' }}>
                          Gunakan panel di atas untuk membuat <strong>Warm Backup</strong> atau <strong>Cold Backup</strong> pertama Anda.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => {
                      const isWarm = b.backup_mode === 'WARM';
                      return (
                        <tr key={b.id}>
                          <td>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              {b.snapshot_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {b.notes || 'Snapshot Backup'}
                            </div>
                            {b.restore_count > 0 && (
                              <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                                ✓ Telah di-restore {b.restore_count}x (terakhir: {b.restored_at ? new Date(b.restored_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'})
                              </div>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '5px',
                                background: isWarm ? '#fffbeb' : '#f0f9ff',
                                color: isWarm ? '#d97706' : '#0284c7',
                                border: `1px solid ${isWarm ? '#fde68a' : '#bae6fd'}`
                              }}>
                                {isWarm ? 'WARM (Live Snapshot)' : 'COLD (Offline Archive)'}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: '#1e3a8a',
                                background: '#eff6ff',
                                padding: '1px 7px',
                                borderRadius: '4px'
                              }}>
                                {b.backup_provider}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              {b.size_gb} GB <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>• {b.storage_repo}</span>
                            </div>
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                              {b.compression}
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {new Date(b.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                              Oleh: {b.created_by_name || 'Operator'}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setConfirmRestoreBackup(b)}
                                disabled={restoringId !== null}
                                title="Restore VM ke titik backup ini"
                                style={{
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  borderColor: '#a7f3d0',
                                  fontWeight: 700
                                }}
                              >
                                <RotateCcw size={13} />
                                <span>Restore</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteBackup(b)}
                                disabled={deletingId === b.id}
                                title="Hapus Snapshot Backup"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Operator &amp; Administrator dapat melakukan Backup (Warm/Cold) dan Restore mandiri pada VM yang ditugaskan.
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

