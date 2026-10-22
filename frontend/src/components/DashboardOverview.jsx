import React from 'react';
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
  ArrowUpRight
} from 'lucide-react';

export default function DashboardOverview({ summary, onNavigateTab }) {
  if (!summary) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading cloud infrastructure metrics...</div>;
  }

  const {
    total_clusters = 4,
    total_nodes = 12,
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
            Maritime Hybrid Fleet Controller — 3 VMware vSphere Clusters + 1 Proxmox VE Cluster
          </p>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          background: 'rgba(16, 185, 129, 0.08)', 
          border: '1px solid rgba(16, 185, 129, 0.25)', 
          padding: '8px 18px', 
          borderRadius: '9999px',
          boxShadow: '0 1px 6px rgba(16, 185, 129, 0.1)'
        }}>
          <span className="status-dot online"></span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
            12 Nodes Operational & Synchronized
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
              3 VMware + 1 Proxmox
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
            <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
              3 Nodes / Cluster (100% Ready)
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

      {/* Cluster Quick Cards (4 Clusters) */}
      <div style={{ marginBottom: '34px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Cluster Infrastructure Fleet</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateTab('clusters')}
          >
            <span>Inspect All 12 Physical Nodes</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

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
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>{cluster.nodes?.length || 3} Online</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>CPU CORES</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a' }}>{cluster.total_cpu_cores} Cores</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>STORAGE</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{cluster.total_storage_tb} TB</div>
                  </div>
                </div>
              </div>
            );
          })}
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
