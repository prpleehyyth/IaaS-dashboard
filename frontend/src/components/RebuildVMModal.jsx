import React, { useState, useEffect } from 'react';
import { X, Disc, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

const OS_OPTIONS = [
  'Ubuntu 22.04 LTS',
  'Ubuntu 24.04 LTS',
  'Debian 12 Bookworm',
  'Alpine Linux 3.19',
  'Rocky Linux 9',
  'Windows Server 2022',
  'Arch Linux'
];

export default function RebuildVMModal({ vm, onClose, onRebuildSuccess }) {
  const [osType, setOsType] = useState(vm?.os_type || 'Ubuntu 22.04 LTS');
  const [isoList, setIsoList] = useState([]);
  const [selectedIso, setSelectedIso] = useState('');
  const [startAfter, setStartAfter] = useState(true);
  const [isLoadingIsos, setIsLoadingIsos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vm) return;
    const loadISOs = async () => {
      setIsLoadingIsos(true);
      try {
        const isos = await api.getClusterISOs(vm.cluster_id, vm.node_id);
        setIsoList(isos || []);
        if (isos && isos.length > 0) {
          setSelectedIso(isos[0].volid);
        }
      } catch (err) {
        console.warn('Failed to load cluster ISOs:', err);
      } finally {
        setIsLoadingIsos(false);
      }
    };
    loadISOs();
  }, [vm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!osType) {
      setError('Pilih sistem operasi target.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await api.rebuildVM(vm.id, {
        os_type: osType,
        iso_image: selectedIso || '',
        start_after: startAfter,
      });
      onRebuildSuccess(`Instalasi ulang OS untuk '${vm.name}' berhasil diinisialisasi!`);
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal melakukan instalasi ulang OS');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '10px', 
              background: '#eff6ff', 
              border: '1px solid #bfdbfe',
              color: '#1e3a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Disc size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Instalasi Ulang OS (Rebuild)</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target VM: <strong style={{ color: 'var(--text-main)' }}>{vm?.name}</strong> (Node: {vm?.node_name || vm?.node_id})
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>

        {/* Warning Banner */}
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.08)', 
          border: '1px solid rgba(245, 158, 11, 0.3)', 
          borderRadius: '10px', 
          padding: '12px 14px', 
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start'
        }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.45 }}>
            <strong>Perhatian:</strong> Instalasi ulang (rebuild) akan mematikan VM jika sedang aktif dan memasang media instalasi baru ke boot drive. Data sistem operasi sebelumnya akan diatur ulang.
          </div>
        </div>

        {/* Current Specs Summary */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '8px', 
          background: '#f8fafc', 
          padding: '12px', 
          borderRadius: '10px', 
          border: '1px solid var(--border-subtle)',
          marginBottom: '20px'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>CPU</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{vm?.cpu_cores} vCPU</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>RAM</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{Math.round((vm?.ram_mb || 0) / 1024)} GB</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>STORAGE</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{vm?.disk_gb} GB Disk</div>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: '16px' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Target OS Selection */}
          <div className="form-group">
            <label className="form-label">Sistem Operasi Target</label>
            <select
              className="form-select"
              value={osType}
              onChange={(e) => setOsType(e.target.value)}
              disabled={isSubmitting}
            >
              {OS_OPTIONS.map((os) => (
                <option key={os} value={os}>{os}</option>
              ))}
            </select>
          </div>

          {/* ISO Image Selection */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>ISO Installation Media</label>
              {isLoadingIsos && (
                <span style={{ fontSize: '0.75rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={12} className="spin" /> Memuat ISO cluster...
                </span>
              )}
            </div>

            <select
              className="form-select"
              value={selectedIso}
              onChange={(e) => setSelectedIso(e.target.value)}
              disabled={isSubmitting || isLoadingIsos}
            >
              {isoList.length === 0 ? (
                <option value="">Gunakan image default cloud / Network installer</option>
              ) : (
                <>
                  <option value="">Gunakan image default cloud</option>
                  {isoList.map((iso) => (
                    <option key={iso.volid} value={iso.volid}>
                      {iso.filename} ({iso.size_gb} GB - {iso.storage})
                    </option>
                  ))}
                </>
              )}
            </select>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Media instalasi ISO yang terdeteksi di storage cluster node.
            </div>
          </div>

          {/* Auto Boot Option */}
          <div style={{ 
            background: '#ffffff', 
            border: '1px solid var(--border-subtle)', 
            padding: '12px 14px', 
            borderRadius: '9px', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Nyalakan VM Otomatis Setelah Rebuild
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Boot VM langsung ke installer OS setelah konfigurasi media selesai.
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={startAfter} 
              onChange={(e) => setStartAfter(e.target.checked)}
              disabled={isSubmitting}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ background: '#1e3a8a', borderColor: '#1e3a8a' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Sedang Memproses Rebuild...</span>
                </>
              ) : (
                <>
                  <Disc size={15} />
                  <span>Mulai Instalasi Ulang OS</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
