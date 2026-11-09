import React, { useState } from 'react';
import { X, Cpu, Database, HardDrive, AlertCircle } from 'lucide-react';

export default function EditVMModal({ vm, onClose, onUpdate }) {
  const [name, setName] = useState(vm.name);
  const [cpuCores, setCpuCores] = useState(vm.cpu_cores);
  const [ramGB, setRamGB] = useState(Math.round(vm.ram_mb / 1024));
  const [diskGB, setDiskGB] = useState(vm.disk_gb);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Ubah Spesifikasi Virtual Machine</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Atur ulang vCPU, Memory, dan Storage untuk {vm.name}
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
            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
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
                  min={vm.disk_gb} // Cannot shrink disk
                  max="500" 
                  step="10"
                  value={diskGB} 
                  onChange={(e) => setDiskGB(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                />
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  * Hypervisor allows dynamic disk expansion (cannot shrink below current {vm.disk_gb} GB).
                </div>
              </div>
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
