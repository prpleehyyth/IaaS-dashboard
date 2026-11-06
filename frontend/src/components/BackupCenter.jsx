import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
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
  Server,
  Search,
  ExternalLink,
  Layers
} from 'lucide-react';
import { api } from '../api/client';

export default function BackupCenter({
  vms = [],
  user,
  onOpenBackupModal,
  onNavigateVM,
  onRefresh,
  showToast
}) {
  const isAdmin = user?.role === 'ADMIN' || api.isAdmin();

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Quick Create Backup Form State
  const [selectedVMId, setSelectedVMId] = useState('');
  const [selectedMode, setSelectedMode] = useState('WARM');
  const [selectedProvider, setSelectedProvider] = useState('PBS');
  const [notes, setNotes] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');
  const [filterProvider, setFilterProvider] = useState('ALL');
  const [filterVMId, setFilterVMId] = useState('ALL');

  // Restore Confirmation State
  const [confirmRestoreBackup, setConfirmRestoreBackup] = useState(null);
  const [startAfterRestore, setStartAfterRestore] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const selectedVM = useMemo(
    () => vms.find((v) => v.id === selectedVMId) || vms[0] || null,
    [vms, selectedVMId]
  );

  // Sync default selected VM & provider when VMs load or selection changes
  useEffect(() => {
    if (vms.length > 0 && (!selectedVMId || !vms.some((v) => v.id === selectedVMId))) {
      const first = vms[0];
      setSelectedVMId(first.id);
      if (first.backup_mode && first.backup_mode !== 'NONE') {
        setSelectedMode(first.backup_mode);
      }
      if (first.hypervisor_type === 'VMWARE') {
        setSelectedProvider(
          first.backup_provider === 'VEEAM' || first.backup_provider === 'NETAPP'
            ? first.backup_provider
            : 'NETAPP'
        );
      } else {
        setSelectedProvider('PBS');
      }
    }
  }, [vms, selectedVMId]);

  const handleSelectVMChange = (vmId) => {
    setSelectedVMId(vmId);
    const target = vms.find((v) => v.id === vmId);
    if (target) {
      if (target.backup_mode && target.backup_mode !== 'NONE') {
        setSelectedMode(target.backup_mode);
      }
      if (target.hypervisor_type === 'VMWARE') {
        setSelectedProvider(
          target.backup_provider === 'VEEAM' || target.backup_provider === 'NETAPP'
            ? target.backup_provider
            : 'NETAPP'
        );
      } else {
        setSelectedProvider('PBS');
      }
    }
  };

  const loadAllBackups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.getAllBackups();
      setBackups(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar snapshot backup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllBackups();
  }, [loadAllBackups]);

  const handleCreateBackup = async (e) => {
    if (e) e.preventDefault();
    if (!selectedVM) {
      setError('Pilih Virtual Machine terlebih dahulu');
      return;
    }
    setError('');
    setCreatingBackup(true);
    try {
      const isVMware = selectedVM.hypervisor_type === 'VMWARE';
      const provider = isVMware ? selectedProvider : 'PBS';
      const res = await api.triggerVMBackup(selectedVM.id, {
        backup_mode: selectedMode,
        backup_provider: provider,
        notes: notes.trim()
      });
      setNotes('');
      if (showToast) {
        showToast(
          res.message ||
            `Backup ${selectedMode} (${provider}) berhasil dibuat untuk '${selectedVM.name}'`
        );
      }
      await loadAllBackups();
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err.message || 'Gagal membuat snapshot backup baru');
      if (showToast) showToast(err.message || 'Gagal membuat backup', 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestoreBackup) return;
    setError('');
    setRestoringId(confirmRestoreBackup.id);
    try {
      const res = await api.restoreVMBackup(
        confirmRestoreBackup.vm_id,
        confirmRestoreBackup.id,
        { start_after: startAfterRestore }
      );
      if (showToast) {
        showToast(
          res.message ||
            `VM '${confirmRestoreBackup.vm_name}' berhasil di-restore dari snapshot '${confirmRestoreBackup.snapshot_name}'`
        );
      }
      setConfirmRestoreBackup(null);
      await loadAllBackups();
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err.message || 'Gagal melakukan restore VM');
      if (showToast) showToast(err.message || 'Gagal melakukan restore', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteBackup = async (backup) => {
    if (
      !window.confirm(
        `Hapus snapshot backup '${backup.snapshot_name}' milik VM '${backup.vm_name}'?`
      )
    ) {
      return;
    }
    setDeletingId(backup.id);
    setError('');
    try {
      await api.deleteVMBackup(backup.vm_id, backup.id);
      if (showToast) {
        showToast(`Snapshot '${backup.snapshot_name}' berhasil dihapus`);
      }
      await loadAllBackups();
      if (onRefresh) await onRefresh();
    } catch (err) {
      setError(err.message || 'Gagal menghapus snapshot backup');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered backups
  const filteredBackups = useMemo(() => {
    return backups.filter((b) => {
      const matchSearch =
        !searchTerm ||
        (b.snapshot_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.vm_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.storage_repo || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchMode = filterMode === 'ALL' || b.backup_mode === filterMode;
      const matchProvider =
        filterProvider === 'ALL' || b.backup_provider === filterProvider;
      const matchVM = filterVMId === 'ALL' || b.vm_id === filterVMId;
      return matchSearch && matchMode && matchProvider && matchVM;
    });
  }, [backups, searchTerm, filterMode, filterProvider, filterVMId]);

  // Summary metrics
  const stats = useMemo(() => {
    const warmCount = backups.filter((b) => b.backup_mode === 'WARM').length;
    const coldCount = backups.filter((b) => b.backup_mode === 'COLD').length;
    const totalSizeGB = backups.reduce((acc, b) => acc + Number(b.size_gb || 0), 0);
    const protectedVMs = vms.filter(
      (v) => v.backup_mode === 'WARM' || v.backup_mode === 'COLD' || (v.backup_count || 0) > 0
    ).length;
    return { warmCount, coldCount, totalSizeGB, protectedVMs };
  }, [backups, vms]);

  const isSelectedVMware = selectedVM?.hypervisor_type === 'VMWARE';

  return (
    <div>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>
              Backup &amp; Restore Center
            </h1>
            <span
              style={{
                fontSize: '0.82rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '4px 12px',
                borderRadius: '8px',
                color: '#1e3a8a',
                fontWeight: 700
              }}
            >
              {backups.length} Restore Points • {vms.length} VM Diakses
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            {isAdmin
              ? 'Pusat Kendali Backup & Disaster Recovery Multi-Hypervisor: Proxmox Backup Server (PBS), NetApp ONTAP SnapCenter & Veeam B&R'
              : 'Self-Service Portal Operator: Lihat daftar backup VM Anda, jalankan Warm/Cold Backup, dan lakukan Restore VM secara mandiri'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadAllBackups}
          disabled={loading}
          style={{ padding: '8px 16px', fontSize: '0.84rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Segarkan Data Backup</span>
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#1e3a8a', borderColor: '#bfdbfe' }}>
            <Database size={24} />
          </div>
          <div>
            <div className="stat-val">{backups.length}</div>
            <div className="stat-lbl">Total Snapshot Tersedia</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Siap di-restore kapan saja
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: '#fffbeb', color: '#d97706', borderColor: '#fde68a' }}>
            <Flame size={24} />
          </div>
          <div>
            <div className="stat-val" style={{ color: '#b45309' }}>{stats.warmCount}</div>
            <div className="stat-lbl">Warm Backups (Live)</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Zero-Downtime Online Snapshot
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}>
            <Snowflake size={24} />
          </div>
          <div>
            <div className="stat-val" style={{ color: '#0369a1' }}>{stats.coldCount}</div>
            <div className="stat-lbl">Cold Backups (Archive)</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Full Consistent Stop/Archive
            </div>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
            <Shield size={24} />
          </div>
          <div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {stats.totalSizeGB.toFixed(1)} <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>GB</span>
            </div>
            <div className="stat-lbl">Total Pemakaian Repo</div>
            <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
              {stats.protectedVMs} dari {vms.length} VM Terlindungi
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: '20px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Create Warm / Cold Backup Card */}
      {vms.length > 0 && (
        <div className="glass-panel" style={{ padding: '22px 24px', marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Plus size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Buat Backup Baru (Warm / Cold Snapshot)
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Pilih VM Anda, tentukan mode Warm (Live) atau Cold (Offline Archive), lalu jalankan ke repository PBS / NetApp / Veeam.
                </p>
              </div>
            </div>

            {selectedVM && (
              <span className={isSelectedVMware ? 'badge-vmware' : 'badge-proxmox'}>
                {selectedVM.hypervisor_type} •{' '}
                {isSelectedVMware
                  ? selectedProvider === 'VEEAM'
                    ? 'Veeam Backup & Replication'
                    : 'NetApp ONTAP SnapCenter'
                  : 'Proxmox Backup Server (PBS)'}
              </span>
            )}
          </div>

          <form onSubmit={handleCreateBackup}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '16px',
                alignItems: 'end'
              }}
            >
              {/* 1. Target VM */}
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '6px' }}>
                  1. Pilih Virtual Machine
                </label>
                <select
                  className="form-select"
                  value={selectedVMId}
                  onChange={(e) => handleSelectVMChange(e.target.value)}
                  style={{ padding: '9px 12px', fontSize: '0.86rem', fontWeight: 700 }}
                >
                  {vms.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.hypervisor_type} • {v.disk_gb} GB • {v.backup_count || 0} Backup)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Mode Backup: WARM vs COLD */}
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '6px' }}>
                  2. Mode Backup (Warm / Cold)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('WARM')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: selectedMode === 'WARM' ? '2px solid #d97706' : '1px solid #cbd5e1',
                      background: selectedMode === 'WARM' ? '#fffbeb' : '#ffffff',
                      color: selectedMode === 'WARM' ? '#b45309' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <Flame size={14} color="#d97706" />
                    <span>WARM (Live)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('COLD')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: selectedMode === 'COLD' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: selectedMode === 'COLD' ? '#f0f9ff' : '#ffffff',
                      color: selectedMode === 'COLD' ? '#0369a1' : 'var(--text-main)',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <Snowflake size={14} color="#0284c7" />
                    <span>COLD (Archive)</span>
                  </button>
                </div>
              </div>

              {/* 3. Engine / Provider */}
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '6px' }}>
                  3. Engine Backup ({selectedVM?.hypervisor_type || 'PROXMOX'})
                </label>
                {!isSelectedVMware ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '2px solid #059669',
                      background: '#ecfdf5',
                      color: '#065f46',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Proxmox Backup Server (PBS)</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857' }}>ZSTD</span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('NETAPP')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: selectedProvider === 'NETAPP' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: selectedProvider === 'NETAPP' ? '#f0f9ff' : '#ffffff',
                        color: selectedProvider === 'NETAPP' ? '#0284c7' : 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      NetApp ONTAP
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('VEEAM')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: selectedProvider === 'VEEAM' ? '2px solid #059669' : '1px solid #cbd5e1',
                        background: selectedProvider === 'VEEAM' ? '#ecfdf5' : '#ffffff',
                        color: selectedProvider === 'VEEAM' ? '#059669' : 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      Veeam B&amp;R
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Notes & Execute */}
              <div>
                <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '6px' }}>
                  4. Catatan &amp; Eksekusi
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Catatan snapshot..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ padding: '8px 11px', fontSize: '0.84rem', flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={creatingBackup || !selectedVM}
                    style={{ padding: '8px 16px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                  >
                    {creatingBackup ? (
                      <>
                        <RefreshCw size={14} className="spin" />
                        <span>Proses...</span>
                      </>
                    ) : (
                      <>
                        <Database size={14} />
                        <span>Backup Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Restore Confirmation Banner */}
      {confirmRestoreBackup && (
        <div
          style={{
            background: '#fffbeb',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '18px 20px',
            marginBottom: '22px',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.14)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#b45309',
                  fontWeight: 800,
                  fontSize: '1rem'
                }}
              >
                <RotateCcw size={18} />
                <span>
                  Konfirmasi Restore Mandiri — VM: {confirmRestoreBackup.vm_name}
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#78350f', margin: '6px 0 10px 0' }}>
                Anda akan memulihkan state disk &amp; konfigurasi{' '}
                <strong>{confirmRestoreBackup.vm_name}</strong> ke snapshot{' '}
                <code
                  style={{
                    background: '#fef3c7',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}
                >
                  {confirmRestoreBackup.snapshot_name}
                </code>{' '}
                ({confirmRestoreBackup.backup_provider} • {confirmRestoreBackup.backup_mode} Backup •{' '}
                {new Date(confirmRestoreBackup.created_at).toLocaleString('id-ID')}).
              </p>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: '#92400e'
                }}
              >
                <input
                  type="checkbox"
                  checked={startAfterRestore}
                  onChange={(e) => setStartAfterRestore(e.target.checked)}
                  style={{ accentColor: '#d97706', width: '16px', height: '16px' }}
                />
                <span>Nyalakan VM otomatis setelah proses Restore selesai (Auto-Start VM)</span>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                    <RefreshCw size={14} className="spin" />
                    <span>Restoring VM...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    <span>Ya, Eksekusi Restore Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 20px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <Search
            size={15}
            color="#1e3a8a"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Cari nama snapshot, VM, repository, atau catatan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', fontSize: '0.84rem', padding: '8px 12px 8px 36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>VM:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={filterVMId}
              onChange={(e) => setFilterVMId(e.target.value)}
            >
              <option value="ALL">Semua VM ({vms.length})</option>
              {vms.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mode:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
            >
              <option value="ALL">Semua Mode</option>
              <option value="WARM">WARM (Live Snapshot)</option>
              <option value="COLD">COLD (Consistent Archive)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Engine:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
            >
              <option value="ALL">Semua Engine</option>
              <option value="PBS">Proxmox PBS</option>
              <option value="NETAPP">VMware NetApp ONTAP</option>
              <option value="VEEAM">VMware Veeam B&amp;R</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Backups Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Virtual Machine</th>
              <th>Snapshot / Archive Name</th>
              <th>Mode &amp; Engine</th>
              <th>Repository &amp; Ukuran</th>
              <th>Waktu &amp; Pembuat</th>
              <th style={{ textAlign: 'right' }}>Aksi Restore Mandiri</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px auto', color: '#1e3a8a' }} />
                  <div>Memuat katalog backup &amp; titik restore...</div>
                </td>
              </tr>
            ) : filteredBackups.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '46px 20px', color: 'var(--text-muted)' }}>
                  <Database size={36} color="var(--text-dim)" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Belum Ada Snapshot Backup yang Ditemukan
                  </div>
                  <div style={{ fontSize: '0.84rem' }}>
                    Gunakan panel <strong>Buat Backup Baru (Warm / Cold Snapshot)</strong> di atas untuk membuat titik restore pertama Anda.
                  </div>
                </td>
              </tr>
            ) : (
              filteredBackups.map((b) => {
                const isWarm = b.backup_mode === 'WARM';
                const isVMware = b.hypervisor_type === 'VMWARE';
                return (
                  <tr key={b.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div>
                          <div
                            onClick={() => onNavigateVM && onNavigateVM(b.vm_id)}
                            style={{
                              fontWeight: 800,
                              color: 'var(--text-main)',
                              fontSize: '0.92rem',
                              cursor: onNavigateVM ? 'pointer' : 'default',
                              textDecoration: onNavigateVM ? 'underline dotted' : 'none'
                            }}
                          >
                            {b.vm_name || 'VM Instance'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                              {b.hypervisor_type}
                            </span>
                            {b.vmid > 0 && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                #{b.vmid}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {b.snapshot_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {b.notes || 'Automated / On-Demand Snapshot'}
                      </div>
                      {b.restore_count > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                          ✓ Telah di-restore {b.restore_count}x (terakhir:{' '}
                          {b.restored_at
                            ? new Date(b.restored_at).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })
                            : '-'}
                          )
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span
                          style={{
                            fontSize: '0.71rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: isWarm ? '#fffbeb' : '#f0f9ff',
                            color: isWarm ? '#b45309' : '#0369a1',
                            border: `1px solid ${isWarm ? '#fde68a' : '#bae6fd'}`
                          }}
                        >
                          {isWarm ? '🔥 WARM (Live Snapshot)' : '❄️ COLD (Archive)'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#1e3a8a',
                            background: '#eff6ff',
                            padding: '1px 7px',
                            borderRadius: '4px',
                            border: '1px solid #bfdbfe'
                          }}
                        >
                          {b.backup_provider === 'PBS'
                            ? 'Proxmox PBS'
                            : b.backup_provider === 'NETAPP'
                            ? 'NetApp ONTAP'
                            : 'Veeam B&R'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {Number(b.size_gb || 0).toFixed(2)} GB{' '}
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>• {b.storage_repo}</span>
                      </div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {b.compression}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {new Date(b.created_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
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
                          <span>Restore VM</span>
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
  );
}

