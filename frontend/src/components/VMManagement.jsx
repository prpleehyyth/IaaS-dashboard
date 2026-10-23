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
  Lock,
  Disc,
  Activity
} from 'lucide-react';

export default function VMManagement({ 
  vms, 
  user, 
  clusters,
  fleetTelemetry = {},
  onStartVM, 
  onStopVM, 
  onRestartVM, 
  onOpenConsole, 
  onOpenCreateModal, 
  onOpenEditModal, 
  onOpenRebuildModal,
  onOpenResourceModal,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Maritime Virtual Machine Fleet</h1>
            <span style={{ 
              fontSize: '0.85rem', 
              background: '#eff6ff', 
              border: '1px solid #bfdbfe',
              padding: '4px 12px', 
              borderRadius: '8px', 
              color: '#1e3a8a',
              fontWeight: 700
            }}>
              {filteredVMs.length} of {vms.length} Instances
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            {isAdmin 
              ? 'Administrator Fleet Control: Full lifecycle privileges (Provision, Power, Edit Specs, Decommission, Console)' 
              : 'VM Operator Control: Delegated vessel controls (Power On, Power Off, and Remote Web Console)'}
          </p>
        </div>

        {/* Create VM Button or Operator Notice */}
        <div>
          {isAdmin ? (
            <button 
              className="btn btn-primary"
              onClick={onOpenCreateModal}
              style={{ padding: '10px 20px', fontSize: '0.9rem' }}
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Provision Virtual Machine</span>
            </button>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: '#f8fafc', 
              padding: '9px 16px', 
              borderRadius: '9px', 
              border: '1px solid var(--border-subtle)', 
              color: 'var(--text-muted)', 
              fontSize: '0.84rem' 
            }}>
              <Lock size={15} color="#1e3a8a" />
              <span>VM Provisioning reserved for Admiralty Admin</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 22px', marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
            <Search size={16} color="#1e3a8a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by vessel name, IP address, or OS..."
              className="form-input"
              style={{ paddingLeft: '38px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Cluster Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cluster:</span>
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '7px 14px', fontSize: '0.84rem' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '7px 14px', fontSize: '0.84rem' }}
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
              <th>Virtual Machine Vessel</th>
              <th>Hypervisor & Node</th>
              <th>IP & Networking</th>
              <th>Compute & Storage</th>
              <th>Power State</th>
              <th style={{ textAlign: 'right' }}>Vessel Controls</th>
            </tr>
          </thead>
          <tbody>
            {filteredVMs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '50px 20px' }}>
                  <HardDrive size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {vms.length === 0 ? 'No Virtual Machines Deployed (Virgin State)' : 'No virtual machines match filter criteria'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {vms.length === 0 
                      ? (isAdmin ? 'Deploy your first virtual machine vessel using the "+ Provision Virtual Machine" button above.' : 'No virtual machines are currently assigned to your account.')
                      : 'Try adjusting your search terms or cluster filter.'}
                  </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '38px', 
                          height: '38px', 
                          borderRadius: '10px', 
                          background: isRunning ? '#eff6ff' : '#f1f5f9',
                          color: isRunning ? '#1e3a8a' : 'var(--text-dim)',
                          border: isRunning ? '1px solid #bfdbfe' : '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <HardDrive size={19} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.98rem' }}>{vm.name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>{vm.os_type}</div>
                        </div>
                      </div>
                    </td>

                    {/* Cluster & Node */}
                    <td>
                      <div>
                        <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'} style={{ marginBottom: '4px' }}>
                          {vm.hypervisor_type}
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                          <Server size={13} color="#1e3a8a" />
                          <span>{vm.node_name || vm.node_id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Network Info */}
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {vm.ip_address || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {vm.mac_address || 'No MAC'}
                      </div>
                    </td>

                    {/* Specs & Live Resource Usage */}
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                          <span style={{ color: '#1e3a8a', fontWeight: 700 }}>{vm.cpu_cores} vCPU</span>
                          <span style={{ color: 'var(--text-dim)' }}>•</span>
                          <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{Math.round(vm.ram_mb / 1024)} GB RAM</span>
                          <span style={{ color: 'var(--text-dim)' }}>•</span>
                          <span style={{ color: '#0f172a', fontWeight: 700 }}>{vm.disk_gb} GB Disk</span>
                        </div>
                        {isRunning && fleetTelemetry[vm.id] && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', fontSize: '0.74rem' }}>
                            <span style={{ 
                              background: fleetTelemetry[vm.id].cpu_usage_pct > 80 ? '#fef2f2' : '#eff6ff', 
                              border: `1px solid ${fleetTelemetry[vm.id].cpu_usage_pct > 80 ? '#fecaca' : '#bfdbfe'}`,
                              color: fleetTelemetry[vm.id].cpu_usage_pct > 80 ? '#dc2626' : '#1e3a8a',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 700
                            }}>
                              CPU: {fleetTelemetry[vm.id].cpu_usage_pct}%
                            </span>
                            <span style={{ 
                              background: fleetTelemetry[vm.id].ram_usage_pct > 85 ? '#fef2f2' : '#f0fdf4', 
                              border: `1px solid ${fleetTelemetry[vm.id].ram_usage_pct > 85 ? '#fecaca' : '#bbf7d0'}`,
                              color: fleetTelemetry[vm.id].ram_usage_pct > 85 ? '#dc2626' : '#166534',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 700
                            }}>
                              RAM: {fleetTelemetry[vm.id].ram_usage_pct}%
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></span>
                        <span style={{ 
                          fontSize: '0.84rem', 
                          fontWeight: 700, 
                          color: isRunning ? '#059669' : 'var(--text-dim)' 
                        }}>
                          {vm.status}
                        </span>
                      </div>
                    </td>

                    {/* Vessel Controls (Available to Admin & Non-Admin Operators) */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {/* Power Start / Stop */}
                        {isRunning ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Graceful Stop VM"
                            disabled={isLoading}
                            onClick={() => handleAction(onStopVM, vm)}
                            style={{ color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.25)' }}
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
                          title="Reboot VM"
                          disabled={!isRunning || isLoading}
                          onClick={() => handleAction(onRestartVM, vm)}
                        >
                          <RotateCw size={13} />
                        </button>

                        {/* Instalasi Ulang OS (Rebuild) - Available to Admin & Operator */}
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Instalasi Ulang OS (Rebuild) VM"
                          onClick={() => onOpenRebuildModal && onOpenRebuildModal(vm)}
                          style={{
                            color: '#1e3a8a',
                            borderColor: '#bfdbfe',
                            background: '#eff6ff'
                          }}
                        >
                          <Disc size={13} />
                          <span>Rebuild</span>
                        </button>

                        {/* Live Resource Monitor - Available to Admin & Operator */}
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Pantau Penggunaan Resource Langsung (CPU, RAM, Disk, Net)"
                          onClick={() => onOpenResourceModal && onOpenResourceModal(vm)}
                          style={{
                            color: isRunning ? '#059669' : '#475569',
                            borderColor: isRunning ? '#a7f3d0' : 'var(--border-subtle)',
                            background: isRunning ? '#ecfdf5' : '#f8fafc'
                          }}
                        >
                          <Activity size={13} />
                          <span>Monitor</span>
                        </button>

                        {/* Interactive Console */}
                        <button
                          className="btn btn-sm"
                          title={isRunning ? "Buka Remote Web Console" : "Nyalakan VM terlebih dahulu untuk membuka console"}
                          disabled={!isRunning}
                          onClick={() => onOpenConsole(vm)}
                          style={{
                            background: isRunning ? '#eff6ff' : 'rgba(255, 255, 255, 0.05)',
                            color: isRunning ? '#1e3a8a' : '#64748b',
                            border: `1px solid ${isRunning ? '#bfdbfe' : 'rgba(255, 255, 255, 0.1)'}`,
                            boxShadow: isRunning ? '0 1px 3px rgba(30, 58, 138, 0.08)' : 'none',
                            cursor: isRunning ? 'pointer' : 'not-allowed',
                            opacity: isRunning ? 1 : 0.5
                          }}
                        >
                          <Terminal size={14} color={isRunning ? "#1e3a8a" : "#64748b"} />
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
