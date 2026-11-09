import React, { useState, useEffect } from 'react';
import { X, Disc, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

const extractIsoVersion = (filename) => {
  if (!filename) return null;
  const match = filename.match(/\b(\d{1,4}(\.\d+)+|\b20\d{2}\b)/);
  return match ? match[0] : null;
};

const OS_OPTIONS = [
  'Ubuntu',
  'Debian',
  'Rocky Linux',
  'Alpine Linux',
  'Arch Linux',
  'Windows Server',
  'Custom / Other Linux'
];

export default function RebuildVMModal({ vm, onClose, onRebuildSuccess }) {
  const getInitialOsType = (currentOs) => {
    if (!currentOs) return 'Ubuntu';
    const lower = currentOs.toLowerCase();
    if (lower.includes('ubuntu')) return 'Ubuntu';
    if (lower.includes('debian')) return 'Debian';
    if (lower.includes('rocky') || lower.includes('rhel') || lower.includes('centos')) return 'Rocky Linux';
    if (lower.includes('alpine')) return 'Alpine Linux';
    if (lower.includes('arch')) return 'Arch Linux';
    if (lower.includes('win')) return 'Windows Server';
    return OS_OPTIONS.includes(currentOs) ? currentOs : 'Ubuntu';
  };

  const [osType, setOsType] = useState(() => getInitialOsType(vm?.os_type));
  const [isoList, setIsoList] = useState([]);
  const [selectedIso, setSelectedIso] = useState('');
  const [filterByOS, setFilterByOS] = useState(true);
  const [startAfter, setStartAfter] = useState(true);
  const [isLoadingIsos, setIsLoadingIsos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filter ISO installer according to selected target OS (e.g. Ubuntu -> only Ubuntu ISOs)
  const filteredIsoList = React.useMemo(() => {
    if (!isoList || isoList.length === 0) return [];
    if (!filterByOS) return isoList;

    const osLower = (osType || '').toLowerCase();
    let keyword = '';
    if (osLower.includes('ubuntu')) keyword = 'ubuntu';
    else if (osLower.includes('debian')) keyword = 'debian';
    else if (osLower.includes('alpine')) keyword = 'alpine';
    else if (osLower.includes('rocky') || osLower.includes('rhel') || osLower.includes('centos')) keyword = 'rocky';
    else if (osLower.includes('arch')) keyword = 'arch';
    else if (osLower.includes('win')) keyword = 'win';

    if (!keyword) return isoList;

    const matched = isoList.filter((iso) => {
      const name = (iso.filename || '').toLowerCase();
      const vol = (iso.volid || '').toLowerCase();
      if (keyword === 'rocky') {
        return name.includes('rocky') || name.includes('rhel') || name.includes('centos') ||
               vol.includes('rocky') || vol.includes('rhel') || vol.includes('centos');
      }
      return name.includes(keyword) || vol.includes(keyword);
    });

    return matched;
  }, [isoList, osType, filterByOS]);

  useEffect(() => {
    if (!vm) return;
    const loadISOs = async () => {
      setIsLoadingIsos(true);
      try {
        const isos = await api.getClusterISOs(vm.cluster_id, vm.node_id);
        setIsoList(isos || []);
      } catch (err) {
        console.warn('Failed to load cluster ISOs:', err);
      } finally {
        setIsLoadingIsos(false);
      }
    };
    loadISOs();
  }, [vm]);

  // Auto-select matching ISO when filtered list updates or target OS changes
  useEffect(() => {
    if (filteredIsoList.length > 0) {
      if (!selectedIso || !filteredIsoList.some(i => i.volid === selectedIso)) {
        setSelectedIso(filteredIsoList[0].volid);
      }
    } else if (filterByOS && isoList.length > 0) {
      setSelectedIso('');
    }
  }, [filteredIsoList, filterByOS]);

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
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '9px', 
              background: '#eff6ff', 
              border: '1px solid #bfdbfe',
              color: '#1e3a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Disc size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Instalasi Ulang OS (Rebuild)</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target VM: <strong style={{ color: 'var(--text-main)' }}>{vm?.name}</strong> (Node: {vm?.node_name || vm?.node_id})
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting} style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal-body">
            {/* Warning Banner */}
            <div style={{ 
              background: 'rgba(245, 158, 11, 0.08)', 
              border: '1px solid rgba(245, 158, 11, 0.3)', 
              borderRadius: '10px', 
              padding: '12px 14px', 
              marginBottom: '16px',
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
              marginBottom: '16px',
              textAlign: 'center'
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
              <label className="form-label" style={{ marginBottom: 0 }}>ISO Installation Media — Pilih Versi</label>
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
              {filteredIsoList.length === 0 ? (
                <option value="">Gunakan image default cloud / Network installer</option>
              ) : (
                <>
                  <option value="">Gunakan image default cloud</option>
                  {filteredIsoList.map((iso) => {
                    const version = extractIsoVersion(iso.filename);
                    return (
                      <option key={iso.volid} value={iso.volid}>
                        {iso.filename} {version ? `(Versi ${version} • ${iso.size_gb} GB - ${iso.storage})` : `(${iso.size_gb} GB - ${iso.storage})`}
                      </option>
                    );
                  })}
                </>
              )}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: selectedIso ? '#059669' : 'var(--text-dim)' }}>
                {selectedIso
                  ? `✓ Media installer ISO khusus ${osType} siap di-boot.`
                  : (filteredIsoList.length === 0
                      ? `Tidak ditemukan ISO khusus ${osType}.`
                      : 'Pilih file ISO untuk menentukan versi sistem operasi yang akan di-reinstall.')}
              </div>

              {isoList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterByOS(!filterByOS)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1e3a8a',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {filterByOS ? `Tampilkan Semua ISO (${isoList.length})` : `Filter Khusus ${osType} (${filteredIsoList.length})`}
                </button>
              )}
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

          </div>

          {/* Action Buttons */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Sedang Memproses Rebuild...</span>
                </>
              ) : (
                <>
                  <Disc size={14} />
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
