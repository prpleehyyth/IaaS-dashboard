import React, { useState } from 'react';
import { X, Server, Cpu, Database, HardDrive, AlertCircle } from 'lucide-react';

const OS_OPTIONS = [
  'Ubuntu 22.04 LTS',
  'Ubuntu 24.04 LTS',
  'Debian 12 Bookworm',
  'Rocky Linux 9',
  'Alpine Linux 3.19',
  'Arch Linux'
];

export default function CreateVMModal({ clusters, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState(clusters[0]?.id || '');
  const [selectedNodeId, setSelectedNodeId] = useState(clusters[0]?.nodes?.[0]?.id || '');
  const [osType, setOsType] = useState('Ubuntu 22.04 LTS');
  const [cpuCores, setCpuCores] = useState(4);
  const [ramGB, setRamGB] = useState(8);
  const [diskGB, setDiskGB] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);
  const availableNodes = selectedCluster?.nodes || [];

  const handleClusterChange = (newClusterId) => {
    setSelectedClusterId(newClusterId);
    const cluster = clusters.find(c => c.id === newClusterId);
    if (cluster && cluster.nodes && cluster.nodes.length > 0) {
      setSelectedNodeId(cluster.nodes[0].id);
    } else {
      setSelectedNodeId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a valid virtual machine name');
      return;
    }
    if (!selectedClusterId || !selectedNodeId) {
      setError('Target cluster and physical node are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        cluster_id: selectedClusterId,
        node_id: selectedNodeId,
        hypervisor_type: selectedCluster.type,
        cpu_cores: parseInt(cpuCores, 10),
        ram_mb: parseInt(ramGB, 10) * 1024,
        disk_gb: parseInt(diskGB, 10),
        os_type: osType,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to provision virtual machine');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Deploy Virtual Machine</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Hypervisor Provisioning Engine (VMware vSphere & Proxmox VE)
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {clusters.length === 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px 16px', borderRadius: '8px', color: '#b45309', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} />
                <span>
                  <strong>No clusters available.</strong> Please register at least one Proxmox or VMware cluster in the <strong>Clusters</strong> tab before provisioning a virtual machine.
                </span>
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* VM Name */}
            <div className="form-group">
              <label className="form-label">Virtual Machine Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. web-app-prod-01 or db-postgres-node"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Target Cluster & Node */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Target Cluster ({clusters.length} Available)</label>
                <select 
                  className="form-select" 
                  value={selectedClusterId} 
                  onChange={(e) => handleClusterChange(e.target.value)}
                >
                  {clusters.length === 0 ? (
                    <option value="">No clusters registered</option>
                  ) : (
                    clusters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Compute Node ({availableNodes.length} Available)</label>
                <select 
                  className="form-select" 
                  value={selectedNodeId} 
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  disabled={availableNodes.length === 0}
                >
                  {availableNodes.length === 0 ? (
                    <option value="">No nodes in selected cluster</option>
                  ) : (
                    availableNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.ip_address})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {selectedCluster && availableNodes.length === 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '8px', color: '#92400e', fontSize: '0.8rem', marginBottom: '14px' }}>
                Cluster <strong>{selectedCluster.name}</strong> has no registered compute nodes. Go to the <strong>Clusters</strong> tab and click <strong>Sync Fleet</strong> or add a node manually before deploying.
              </div>
            )}

            {/* OS Template */}
            <div className="form-group">
              <label className="form-label">Operating System Image</label>
              <select 
                className="form-select" 
                value={osType} 
                onChange={(e) => setOsType(e.target.value)}
              >
                {OS_OPTIONS.map((os) => (
                  <option key={os} value={os}>{os}</option>
                ))}
              </select>
            </div>

            {/* Hardware Specs Range Sliders */}
            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginTop: '14px' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
                Hardware Resource Allotment
              </div>

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
                  <span style={{ color: 'var(--text-muted)' }}>RAM Memory (GB):</span>
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
                  <span style={{ color: 'var(--text-muted)' }}>Storage Disk Volume:</span>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>{diskGB} GB NVMe/SAN</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="500" 
                  step="10" 
                  value={diskGB} 
                  onChange={(e) => setDiskGB(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || clusters.length === 0}>
              {isSubmitting ? 'Provisioning...' : 'Deploy Virtual Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
