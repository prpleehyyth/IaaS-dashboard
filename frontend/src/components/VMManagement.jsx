import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Square, 
  RotateCw, 
  Terminal, 
  Edit3, 
  Trash2, 
  Layers, 
  Cpu, 
  Database, 
  HardDrive,
  ShieldAlert,
  Server,
  Lock
} from 'lucide-react';

export default function VMManagement({ 
  vms, 
  user, 
  clusters,
  onStartVM, 
  onStopVM, 
  onRestartVM, 
  onOpenConsole, 
  onOpenCreateModal, 
  onOpenEditModal, 
  onDeleteVM 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCluster, setFilterCluster] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loadingActionId, setLoadingActionId] = useState(null);

  const isAdmin = user?.role === 'ADMIN';

  // Filter VMs
  const filteredVMs = vms.filter((vm) => {
    const matchesSearch = vm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (vm.ip_address && vm.ip_address.includes(searchTerm)) ||
                          (vm.os_type && vm.os_type.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCluster = filterCluster === 'ALL' || vm.cluster_id === filterCluster;
    const matchesStatus = filterStatus === 'ALL' || vm.status === filterStatus;
    return matchesSearch && matchesCluster && matchesStatus;
  });

  const handleAction = async (actionFn, vm) => {
    setLoadingActionId(vm.id);
    try {
      await actionFn(vm);
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div>
      {/* Top Banner & Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>Virtual Machine Fleet</h1>
            <span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px', color: 'var(--text-muted)' }}>
              {filteredVMs.length} of {vms.length} Instances
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            {isAdmin 
              ? 'Administrator View: Full lifecycle privileges (Create, Start, Stop, Edit Specs, Delete, Console)' 
              : 'VM Operator View: Delegated self-service controls (Start, Stop, and Remote In-Browser Console)'}
          </p>
        </div>

        {/* Create VM Button or Operator Notice */}
        <div>
          {isAdmin ? (
            <button 
              className="btn btn-primary"
              onClick={onOpenCreateModal}
            >
              <Plus size={16} />
              <span>Create New Virtual Machine</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              <Lock size={14} color="var(--accent-amber)" />
              <span>VM Provisioning reserved for Administrators</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              placeholder="Search by name, IP, or OS..."
              className="form-input"
              style={{ paddingLeft: '36px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Cluster Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Cluster:</span>
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={filterCluster}
              onChange={(e) => setFilterCluster(e.target.value)}
            >
              <option value="ALL">All Clusters</option>
              {clusters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Status:</span>
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="RUNNING">Running Only</option>
              <option value="STOPPED">Stopped Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Virtual Machines Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Virtual Machine</th>
              <th>Hypervisor & Node</th>
              <th>IP & Network</th>
              <th>Allocated Specs</th>
              <th>Power Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVMs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px' }}>
                  No virtual machines found matching current filter criteria.
                </td>
              </tr>
            ) : (
              filteredVMs.map((vm) => {
                const isRunning = vm.status === 'RUNNING';
                const isVMware = vm.hypervisor_type === 'VMWARE';
                const isLoading = loadingActionId === vm.id;

                return (
                  <tr key={vm.id}>
                    {/* VM Info */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '36px', 
                          height: '36px', 
                          borderRadius: '8px', 
                          background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: isRunning ? 'var(--accent-emerald)' : 'var(--text-dim)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <HardDrive size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{vm.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{vm.os_type}</div>
                        </div>
                      </div>
                    </td>

                    {/* Cluster & Node */}
                    <td>
                      <div>
                        <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'} style={{ marginBottom: '4px' }}>
                          {vm.hypervisor_type}
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Server size={12} color="var(--accent-cyan)" />
                          <span>{vm.node_name || vm.node_id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Network Info */}
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#fff' }}>
                        {vm.ip_address || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {vm.mac_address || 'No MAC'}
                      </div>
                    </td>

                    {/* Specs */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--accent-cyan)' }}>{vm.cpu_cores} vCPU</span>
                        <span style={{ color: 'var(--text-dim)' }}>•</span>
                        <span style={{ color: 'var(--accent-emerald)' }}>{Math.round(vm.ram_mb / 1024)} GB RAM</span>
                        <span style={{ color: 'var(--text-dim)' }}>•</span>
                        <span style={{ color: 'var(--accent-amber)' }}>{vm.disk_gb} GB Disk</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></span>
                        <span style={{ 
                          fontSize: '0.82rem', 
                          fontWeight: 600, 
                          color: isRunning ? 'var(--accent-emerald)' : 'var(--text-dim)' 
                        }}>
                          {vm.status}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {/* Power Start / Stop (Allowed for both Admin and Operator) */}
                        {isRunning ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Graceful Stop VM"
                            disabled={isLoading}
                            onClick={() => handleAction(onStopVM, vm)}
                            style={{ color: 'var(--accent-rose)' }}
                          >
                            <Square size={13} />
                            <span>Stop</span>
                          </button>
                        ) : (
                          <button
                            className="btn btn-success btn-sm"
                            title="Power On VM"
                            disabled={isLoading}
                            onClick={() => handleAction(onStartVM, vm)}
                          >
                            <Play size={13} />
                            <span>Start</span>
                          </button>
                        )}

                        {/* Restart Button */}
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Restart VM"
                          disabled={!isRunning || isLoading}
                          onClick={() => handleAction(onRestartVM, vm)}
                        >
                          <RotateCw size={13} />
                        </button>

                        {/* Interactive Console (Allowed for both Admin and Operator) */}
                        <button
                          className="btn btn-primary btn-sm"
                          title="Open Remote Web Console"
                          disabled={!isRunning}
                          onClick={() => onOpenConsole(vm)}
                        >
                          <Terminal size={14} />
                          <span>Console</span>
                        </button>

                        {/* Admin-Only Actions: Edit Specs & Delete */}
                        {isAdmin && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Edit VM Specs (Admin Only)"
                              onClick={() => onOpenEditModal(vm)}
                            >
                              <Edit3 size={13} />
                            </button>

                            <button
                              className="btn btn-danger btn-sm"
                              title="Delete Virtual Machine (Admin Only)"
                              onClick={() => onDeleteVM(vm)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
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
