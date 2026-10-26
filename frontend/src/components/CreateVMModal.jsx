import React, { useState, useEffect } from 'react';
import { X, Server, Cpu, Database, HardDrive, AlertCircle, Disc, RefreshCw, Network, Shield } from 'lucide-react';
import { api } from '../api/client';

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
  const [isoList, setIsoList] = useState([]);
  const [selectedIso, setSelectedIso] = useState('');
  const [isLoadingIsos, setIsLoadingIsos] = useState(false);
  const [filterByOS, setFilterByOS] = useState(true);
  const [cpuCores, setCpuCores] = useState(4);
  const [ramGB, setRamGB] = useState(8);
  const [diskGB, setDiskGB] = useState(50);
  
  // Network & VLAN Configuration
  const [noNetwork, setNoNetwork] = useState(false);
  const [networkBridge, setNetworkBridge] = useState('vmbr0');
  const [vlanTag, setVlanTag] = useState('');
  const [networkModel, setNetworkModel] = useState('virtio');
  const [firewall, setFirewall] = useState(true);
  const [macAddress, setMacAddress] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedCluster = clusters.find(c => c.id === selectedClusterId);
  const availableNodes = selectedCluster?.nodes || [];

  // Filter ISO installer according to selected OS (e.g. Ubuntu -> only Ubuntu ISOs)
  const filteredIsoList = React.useMemo(() => {
    if (!isoList || isoList.length === 0) return [];
    if (!filterByOS) return isoList;

    const osLower = (osType || '').toLowerCase();
    let keyword = '';
    if (osLower.includes('ubuntu')) keyword = 'ubuntu';
    else if (osLower.includes('debian')) keyword = 'debian';
    else if (osLower.includes('alpine')) keyword = 'alpine';
    else if (osLower.includes('rocky')) keyword = 'rocky';
    else if (osLower.includes('arch')) keyword = 'arch';
    else if (osLower.includes('win')) keyword = 'win';

    if (!keyword) return isoList;

    const matched = isoList.filter((iso) => {
      const name = (iso.filename || '').toLowerCase();
      const vol = (iso.volid || '').toLowerCase();
      return name.includes(keyword) || vol.includes(keyword);
    });

    return matched;
  }, [isoList, osType, filterByOS]);

  const fetchISOs = async (clusterId, nodeId) => {
    if (!clusterId) {
      setIsoList([]);
      setSelectedIso('');
      return;
    }
    setIsLoadingIsos(true);
    try {
      const isos = await api.getClusterISOs(clusterId, nodeId);
      setIsoList(isos || []);
    } catch (err) {
      console.warn('Failed to load ISO images:', err);
      setIsoList([]);
    } finally {
      setIsLoadingIsos(false);
    }
  };

  useEffect(() => {
    fetchISOs(selectedClusterId, selectedNodeId);
  }, [selectedClusterId, selectedNodeId]);

  // Auto-select matching ISO when filtered list updates or OS changes
  useEffect(() => {
    if (filteredIsoList.length > 0) {
      if (!selectedIso || !filteredIsoList.some(i => i.volid === selectedIso)) {
        setSelectedIso(filteredIsoList[0].volid);
      }
    } else if (filterByOS && isoList.length > 0) {
      setSelectedIso('');
    }
  }, [filteredIsoList, filterByOS]);

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
        iso_image: selectedIso,
        // Network & VLAN configuration
        network_bridge: noNetwork ? 'none' : (networkBridge.trim() || 'vmbr0'),
        vlan_tag: (!noNetwork && vlanTag && parseInt(vlanTag, 10) > 0) ? parseInt(vlanTag, 10) : null,
        network_model: noNetwork ? 'none' : networkModel,
        firewall: !noNetwork ? firewall : false,
        mac_address: (!noNetwork && macAddress.trim() && macAddress.trim().toLowerCase() !== 'auto') ? macAddress.trim() : 'auto',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px' }}>
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
                Cluster <strong>{selectedCluster.name}</strong> belum memiliki node compute terdaftar. Buka tab <strong>Clusters</strong> dan klik <strong>Sync Cluster</strong> atau tambah node secara manual.
              </div>
            )}

            {/* OS Template */}
            <div className="form-group">
              <label className="form-label">Operating System Profile</label>
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

            {/* Boot / Installer ISO (CD-ROM) */}
            <div className="form-group" style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Disc size={15} style={{ color: 'var(--ocean-blue)' }} />
                  <span>Boot / Installer ISO (CD-ROM)</span>
                </label>
                <button
                  type="button"
                  onClick={() => fetchISOs(selectedClusterId, selectedNodeId)}
                  disabled={isLoadingIsos}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ocean-blue)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 4px'
                  }}
                  title="Scan storage for ISO files"
                >
                  <RefreshCw size={12} className={isLoadingIsos ? 'spin' : ''} />
                  <span>{isLoadingIsos ? 'Scanning...' : 'Scan Storage'}</span>
                </button>
              </div>

              <select
                className="form-select"
                value={selectedIso}
                onChange={(e) => setSelectedIso(e.target.value)}
                disabled={isLoadingIsos}
              >
                <option value="">None (Blank Virtual Disk / Network Boot)</option>
                {filteredIsoList.map((iso) => (
                  <option key={iso.volid} value={iso.volid}>
                    {iso.filename} ({iso.storage} • {iso.size_gb} GB)
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                {selectedIso ? (
                  <div style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>✓ ISO {filterByOS ? `khusus ${osType.split(' ')[0]}` : ''} akan dipasang ke virtual CD-ROM (ide2) dengan prioritas boot utama.</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {filteredIsoList.length === 0 && !isLoadingIsos ? (
                      <span>Tidak ditemukan ISO khusus {osType.split(' ')[0]}.</span>
                    ) : (
                      <span>VM akan diprovision dengan disk kosong tanpa media installer.</span>
                    )}
                  </div>
                )}

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
                    {filterByOS ? `Tampilkan Semua ISO (${isoList.length})` : `Filter Khusus ${osType.split(' ')[0]} (${filteredIsoList.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Network & VLAN Configuration (802.1Q) */}
            <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Network size={16} style={{ color: 'var(--ocean-blue)' }} />
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Network Configuration & VLAN
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={noNetwork}
                    onChange={(e) => setNoNetwork(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--ocean-blue)' }}
                  />
                  <span>No network device</span>
                </label>
              </div>

              {!noNetwork ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
                    {/* Bridge */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Bridge Interface</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. vmbr0"
                        value={networkBridge}
                        onChange={(e) => setNetworkBridge(e.target.value)}
                        required={!noNetwork}
                        style={{ padding: '7px 10px', fontSize: '0.85rem' }}
                      />
                    </div>

                    {/* VLAN Tag */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>VLAN Tag (802.1Q)</label>
                        {vlanTag && parseInt(vlanTag, 10) > 0 && (
                          <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600 }}>
                            Tag: {vlanTag}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="4094"
                        className="form-input"
                        placeholder="no VLAN (e.g. 10, 20, 100)"
                        value={vlanTag}
                        onChange={(e) => setVlanTag(e.target.value)}
                        style={{ padding: '7px 10px', fontSize: '0.85rem' }}
                      />
                    </div>

                    {/* Model */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>vNIC Device Model</label>
                      <select
                        className="form-select"
                        value={networkModel}
                        onChange={(e) => setNetworkModel(e.target.value)}
                        style={{ padding: '7px 10px', fontSize: '0.85rem' }}
                      >
                        <option value="virtio">VirtIO (paravirtualized)</option>
                        <option value="e1000">Intel E1000</option>
                        <option value="vmxnet3">VMware vmxnet3</option>
                        <option value="rtl8139">Realtek RTL8139</option>
                      </select>
                    </div>

                    {/* MAC Address */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>MAC Address</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="auto (generated by PVE)"
                        value={macAddress}
                        onChange={(e) => setMacAddress(e.target.value)}
                        style={{ padding: '7px 10px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {/* Firewall & Live Preview */}
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={firewall}
                        onChange={(e) => setFirewall(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: 'var(--ocean-blue)' }}
                      />
                      <Shield size={13} style={{ color: firewall ? '#059669' : '#94a3b8' }} />
                      <span>Firewall</span>
                    </label>

                    <div style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#1e3a8a', padding: '3px 8px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 600 }}>
                      net0: {networkModel},bridge={networkBridge || 'vmbr0'}{vlanTag && parseInt(vlanTag, 10) > 0 ? `,tag=${vlanTag}` : ''}{firewall ? ',firewall=1' : ',firewall=0'}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>
                  VM akan diprovision tanpa virtual network adapter (air-gapped / no NIC).
                </div>
              )}
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
