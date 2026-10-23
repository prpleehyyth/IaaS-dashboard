import React, { useState } from 'react';
import { 
  Server, 
  Cpu, 
  Database, 
  Layers, 
  HardDrive, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowUpRight,
  Play,
  Square,
  RotateCw,
  Disc,
  Wifi,
  Sparkles
} from 'lucide-react';

export default function DashboardOverview({ 
  summary, 
  vms = [],
  fleetTelemetry = {},
  user,
  onStartVM,
  onStopVM,
  onRestartVM,
  onOpenResourceModal,
  onOpenRebuildModal,
  onNavigateTab 
}) {
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const handleAction = async (fn, vm) => {
    if (!fn) return;
    setActionLoadingId(vm.id);
    try {
      await fn(vm);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!summary) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading cloud infrastructure metrics...</div>;
  }

  const {
    total_clusters = 0,
    total_nodes = 0,
    total_vms = 0,
    running_vms = 0,
    stopped_vms = 0,
    total_cpu_cores = 0,
    allocated_cpu = 0,
    total_ram_gb = 0,
    allocated_ram_gb = 0,
    total_storage_tb = 0,
    allocated_disk_gb = 0,
    clusters = [],
    recent_logs = []
  } = summary;

  const vmwareCount = clusters.filter(c => c.type === 'VMWARE').length;
  const proxmoxCount = clusters.filter(c => c.type === 'PROXMOX').length;

  const cpuPct = total_cpu_cores > 0 ? Math.round((allocated_cpu / total_cpu_cores) * 100) : 0;
  const ramPct = total_ram_gb > 0 ? Math.round((allocated_ram_gb / total_ram_gb) * 100) : 0;
  const storageTotalGB = total_storage_tb * 1000;
  const diskPct = storageTotalGB > 0 ? Math.round((allocated_disk_gb / storageTotalGB) * 100) : 0;

  return (
    <div>
      {/* Page Title & Status Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Infrastructure Command Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            Hybrid Infrastructure Fleet Controller — {clusters.length} Cluster{clusters.length !== 1 ? 's' : ''} ({vmwareCount} VMware + {proxmoxCount} Proxmox)
          </p>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          background: total_nodes > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)', 
          border: total_nodes > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(100, 116, 139, 0.25)', 
          padding: '8px 18px', 
          borderRadius: '9999px',
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <span className={`status-dot ${total_nodes > 0 ? 'online' : 'stopped'}`}></span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: total_nodes > 0 ? '#059669' : 'var(--text-muted)' }}>
            {total_nodes} Compute Node{total_nodes !== 1 ? 's' : ''} Synchronized
          </span>
        </div>
      </div>

      {/* 6 High-Performance Metric Stat Cards */}
      <div className="stat-grid">
        {/* Total Clusters */}
        <div className="glass-panel stat-card">
          <div className="stat-icon">
            <Layers size={25} />
          </div>
          <div>
            <div className="stat-val">{total_clusters}</div>
            <div className="stat-lbl">Managed Clusters</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              {vmwareCount} VMware + {proxmoxCount} Proxmox
            </div>
          </div>
        </div>

        {/* Physical Nodes */}
        <div className="glass-panel stat-card">
          <div className="stat-icon">
            <Server size={25} />
          </div>
          <div>
            <div className="stat-val">{total_nodes}</div>
            <div className="stat-lbl">Physical Compute Nodes</div>
            <div style={{ fontSize: '0.74rem', color: total_nodes > 0 ? '#059669' : 'var(--text-dim)', fontWeight: 600, marginTop: '2px' }}>
              {total_clusters > 0 ? (total_nodes / total_clusters).toFixed(1) : 0} Nodes / Cluster avg
            </div>
          </div>
        </div>

        {/* Total VMs */}
        <div className="glass-panel stat-card">
          <div className="stat-icon">
            <HardDrive size={25} />
          </div>
          <div>
            <div className="stat-val">{total_vms}</div>
            <div className="stat-lbl">Active VM Fleet</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>{running_vms} running</span> • {stopped_vms} stopped
            </div>
          </div>
        </div>

        {/* CPU Allocation */}
        <div className="glass-panel stat-card">
          <div className="stat-icon">
            <Cpu size={25} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-val">
              {allocated_cpu} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>/ {total_cpu_cores} vCPU</span>
            </div>
            <div className="stat-lbl">vCPU Provisioned ({cpuPct}%)</div>
            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', marginTop: '7px' }}>
              <div style={{ width: `${Math.min(cpuPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #0f172a, #1e3a8a)', borderRadius: '3px' }}></div>
            </div>
          </div>
        </div>

        {/* Memory Allocation */}
        <div className="glass-panel stat-card">
          <div className="stat-icon">
            <Database size={25} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-val">
              {allocated_ram_gb} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>/ {total_ram_gb} GB</span>
            </div>
            <div className="stat-lbl">RAM Allocated ({ramPct}%)</div>
            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', marginTop: '7px' }}>
              <div style={{ width: `${Math.min(ramPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #1e3a8a, #2563eb)', borderRadius: '3px' }}></div>
            </div>
          </div>
        </div>

        {/* Storage Capacity */}
        <div className="glass-panel stat-card">
          <div className="stat-icon">
            <HardDrive size={25} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-val">
              {allocated_disk_gb} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>/ {Math.round(storageTotalGB)} GB</span>
            </div>
            <div className="stat-lbl">Storage Pool ({diskPct}%)</div>
            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', marginTop: '7px' }}>
              <div style={{ width: `${Math.min(diskPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #0f172a, #1e3a8a)', borderRadius: '3px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Quick Cards */}
      <div style={{ marginBottom: '34px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Cluster Infrastructure Fleet</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateTab('clusters')}
          >
            <span>Inspect All Nodes ({total_nodes})</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        {clusters.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
            <Layers size={40} color="var(--text-dim)" style={{ margin: '0 auto 14px auto' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              No Hypervisor Clusters Connected (Virgin State)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 20px auto' }}>
              This environment is virgin and clean. Connect your bare-metal Proxmox VE or VMware vSphere cluster in the Clusters tab to begin monitoring hardware and provisioning virtual machines.
            </p>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => onNavigateTab('clusters')}
            >
              <Layers size={15} />
              <span>Connect First Cluster</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {clusters.map((cluster) => {
              const isVMware = cluster.type === 'VMWARE';
              return (
                <div 
                  key={cluster.id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '22px', 
                    borderTop: `3px solid ${isVMware ? 'var(--ocean-blue)' : '#ea580c'}` 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>
                      {cluster.type}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="status-dot online"></span>
                      <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>{cluster.status}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {cluster.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Datacenter: <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{cluster.datacenter}</span> • Endpoint: <span style={{ color: '#1e3a8a', fontFamily: 'var(--font-mono)' }}>{cluster.endpoint}</span>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: '10px', 
                    background: '#f8fafc', 
                    padding: '12px 14px', 
                    borderRadius: '10px', 
                    border: '1px solid var(--border-subtle)' 
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>NODES</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>{cluster.nodes?.length || 0} Online</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>CPU CORES</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a' }}>{cluster.total_cpu_cores} Cores</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>RAM (GB)</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{cluster.total_ram_gb} GB</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live VM Resource Monitoring & Quick Controls */}
      <div style={{ marginBottom: '34px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Direct Resource Monitoring & Quick Controls</h2>
              <span style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '3px 10px',
                borderRadius: '9999px'
              }}>
                <span className="status-dot online" style={{ width: '7px', height: '7px' }}></span>
                Live Fleet Telemetry
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '3px' }}>
              Pantau penggunaan CPU, RAM, Disk secara langsung dan kontrol virtual machine (Start, Stop, Restart, Rebuild OS)
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateTab('vms')}
          >
            <span>Buka VM Management</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Virtual Machine</th>
                <th>Status</th>
                <th>Live CPU Usage</th>
                <th>Live Memory (RAM)</th>
                <th>Uptime / Storage</th>
                <th style={{ textAlign: 'right' }}>Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {vms.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px' }}>
                    Belum ada virtual machine yang aktif atau terdaftar untuk akun ini.
                  </td>
                </tr>
              ) : (
                vms.map((vm) => {
                  const telem = fleetTelemetry[vm.id];
                  const isRunning = vm.status === 'RUNNING';
                  const cpuPct = isRunning ? (telem?.cpu_usage_pct ?? 0) : 0;
                  const ramPct = isRunning ? (telem?.ram_usage_pct ?? 0) : 0;
                  const ramMB = isRunning ? (telem?.ram_usage_mb ?? 0) : 0;
                  const diskPct = isRunning ? (telem?.disk_usage_pct ?? 0) : 0;
                  const isLoading = actionLoadingId === vm.id;

                  const formatUptimeShort = (secs) => {
                    if (!secs || secs <= 0) return '0s';
                    const hrs = Math.floor(secs / 3600);
                    const mins = Math.floor((secs % 3600) / 60);
                    if (hrs > 0) return `${hrs}j ${mins}m`;
                    return `${mins}m`;
                  };

                  return (
                    <tr key={vm.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            background: '#eff6ff', 
                            border: '1px solid #bfdbfe',
                            color: '#1e3a8a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.8rem'
                          }}>
                            <Server size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                              {vm.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              {vm.os_type || 'Linux'} • {vm.ip_address || 'DHCP'} • {vm.hypervisor_type}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></span>
                          <span style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: 700, 
                            color: isRunning ? '#059669' : '#dc2626' 
                          }}>
                            {vm.status}
                          </span>
                        </div>
                      </td>
                      <td style={{ minWidth: '150px' }}>
                        {isRunning ? (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>CPU</span>
                              <span style={{ fontWeight: 800, color: cpuPct > 80 ? '#dc2626' : '#1e3a8a' }}>{cpuPct}%</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${Math.min(cpuPct, 100)}%`, 
                                height: '100%', 
                                background: cpuPct > 80 ? '#dc2626' : 'linear-gradient(90deg, #1e3a8a, #3b82f6)', 
                                borderRadius: '3px',
                                transition: 'width 0.4s ease'
                              }}></div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Offline (0%)</span>
                        )}
                      </td>
                      <td style={{ minWidth: '150px' }}>
                        {isRunning ? (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>RAM</span>
                              <span style={{ fontWeight: 800, color: ramPct > 85 ? '#dc2626' : '#0f172a' }}>
                                {ramMB > 0 ? `${ramMB} MB` : `${ramPct}%`} ({ramPct}%)
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${Math.min(ramPct, 100)}%`, 
                                height: '100%', 
                                background: ramPct > 85 ? '#dc2626' : 'linear-gradient(90deg, #059669, #10b981)', 
                                borderRadius: '3px',
                                transition: 'width 0.4s ease'
                              }}></div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Offline (0 MB)</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>
                          {isRunning ? `Uptime: ${formatUptimeShort(telem?.uptime_seconds)}` : 'Stopped'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Disk: {vm.disk_gb} GB {diskPct > 0 ? `(${diskPct}% used)` : ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {/* Power Start / Stop */}
                          {isRunning ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Stop VM"
                              disabled={isLoading}
                              onClick={() => handleAction(onStopVM, vm)}
                              style={{ color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                            >
                              <Square size={12} />
                              <span>Stop</span>
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              title="Start VM"
                              disabled={isLoading}
                              onClick={() => handleAction(onStartVM, vm)}
                            >
                              <Play size={12} />
                              <span>Start</span>
                            </button>
                          )}

                          {/* Restart */}
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Restart VM"
                            disabled={!isRunning || isLoading}
                            onClick={() => handleAction(onRestartVM, vm)}
                          >
                            <RotateCw size={12} />
                          </button>

                          {/* Rebuild OS */}
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Instalasi Ulang OS (Rebuild)"
                            onClick={() => onOpenRebuildModal && onOpenRebuildModal(vm)}
                            style={{
                              color: '#1e3a8a',
                              borderColor: '#bfdbfe',
                              background: '#eff6ff'
                            }}
                          >
                            <Disc size={12} />
                            <span>Rebuild</span>
                          </button>

                          {/* Live Telemetry Modal */}
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Pantau Resource Langsung (Grafik & Detail)"
                            onClick={() => onOpenResourceModal && onOpenResourceModal(vm)}
                            style={{
                              color: isRunning ? '#059669' : '#475569',
                              borderColor: isRunning ? '#a7f3d0' : 'var(--border-subtle)',
                              background: isRunning ? '#ecfdf5' : '#f8fafc'
                            }}
                          >
                            <Activity size={12} />
                            <span>Monitor</span>
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

      {/* Activity Logs Table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Control Plane Real-time Audit Trail</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Live Timestamped Telemetry</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Target Instance</th>
                <th>Operator</th>
                <th>Execution State</th>
                <th>Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recent_logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px' }}>
                    No activity logs recorded yet.
                  </td>
                </tr>
              ) : (
                recent_logs.map((log) => {
                  const isStart = log.action.includes('START');
                  const isStop = log.action.includes('STOP');
                  const isCreate = log.action.includes('CREATE');

                  return (
                    <tr key={log.id}>
                      <td>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          padding: '3px 9px', 
                          borderRadius: '5px',
                          background: isStart ? '#ecfdf5' :
                                      isStop ? '#fef2f2' :
                                      isCreate ? '#eff6ff' : '#fffbeb',
                          color: isStart ? '#059669' :
                                 isStop ? '#dc2626' :
                                 isCreate ? '#1e3a8a' : '#d97706',
                          border: isStart ? '1px solid #a7f3d0' :
                                  isStop ? '1px solid #fecaca' :
                                  isCreate ? '1px solid #bfdbfe' : '1px solid #fde68a'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{log.vm_name || 'N/A'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{log.username || 'System'}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: log.status === 'SUCCESS' ? '#059669' : '#dc2626' }}>
                          ● {log.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{log.details}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
  );
}
