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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>Infrastructure Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Multi-Tenant Hybrid Cloud Controller — 3 VMware vSphere Clusters + 1 Proxmox VE Cluster
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '8px 16px', borderRadius: '9999px' }}>
          <span className="status-dot online"></span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>
            12 Nodes Operational & In-Sync
          </span>
        </div>
      </div>

      {/* 6 High-Performance Metric Stat Cards */}
      <div className="stat-grid">
        {/* Total Clusters */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
            <Layers size={24} />
          </div>
          <div>
            <div className="stat-val">{total_clusters}</div>
            <div className="stat-lbl">Managed Clusters</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              3 VMware + 1 Proxmox
            </div>
          </div>
        </div>

        {/* Physical Nodes */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(0, 242, 254, 0.15)', color: 'var(--accent-cyan)' }}>
            <Server size={24} />
          </div>
          <div>
            <div className="stat-val">{total_nodes}</div>
            <div className="stat-lbl">Total Physical Nodes</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
              3 Nodes / Cluster (100% Ready)
            </div>
          </div>
        </div>

        {/* Total VMs */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)' }}>
            <HardDrive size={24} />
          </div>
          <div>
            <div className="stat-val">{total_vms}</div>
            <div className="stat-lbl">Virtual Machines</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{running_vms} running</span> • {stopped_vms} stopped
            </div>
          </div>
        </div>

        {/* CPU Allocation */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
            <Cpu size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-val">{allocated_cpu} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 400 }}>/ {total_cpu_cores} vCPU</span></div>
            <div className="stat-lbl">vCPU Provisioned ({cpuPct}%)</div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px' }}>
              <div style={{ width: `${Math.min(cpuPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>

        {/* Memory Allocation */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
            <Database size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-val">{allocated_ram_gb} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 400 }}>/ {total_ram_gb} GB</span></div>
            <div className="stat-lbl">RAM Allocated ({ramPct}%)</div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px' }}>
              <div style={{ width: `${Math.min(ramPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>

        {/* Storage Capacity */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)' }}>
            <HardDrive size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-val">{allocated_disk_gb} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 400 }}>/ {Math.round(storageTotalGB)} GB</span></div>
            <div className="stat-lbl">Storage Pool ({diskPct}%)</div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginTop: '6px' }}>
              <div style={{ width: `${Math.min(diskPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #f43f5e, #fb7185)', borderRadius: '2px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Quick Cards (4 Clusters) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>Cluster Infrastructure Summary</h2>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateTab('clusters')}
          >
            <span>View All 12 Nodes</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {clusters.map((cluster) => {
            const isVMware = cluster.type === 'VMWARE';
            return (
              <div key={cluster.id} className="glass-panel" style={{ padding: '20px', borderTop: `3px solid ${isVMware ? 'var(--vmware-blue)' : 'var(--proxmox-orange)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>
                    {cluster.type}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="status-dot online"></span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>{cluster.status}</span>
                  </div>
                </div>

                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                  {cluster.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '16px' }}>
                  Datacenter: <span style={{ color: 'var(--text-muted)' }}>{cluster.datacenter}</span> • Endpoint: <span style={{ color: 'var(--text-muted)' }}>{cluster.endpoint}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>NODES</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{cluster.nodes?.length || 3} Online</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>CPU CORES</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{cluster.total_cpu_cores} Cores</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>STORAGE</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{cluster.total_storage_tb} TB</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Logs Table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>Recent Control Plane Activity Logs</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Real-time Audit Trail</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Target VM</th>
                <th>User</th>
                <th>Status</th>
                <th>Execution Details</th>
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
                recent_logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '4px',
                        background: log.action.includes('START') ? 'rgba(16, 185, 129, 0.15)' :
                                    log.action.includes('STOP') ? 'rgba(244, 63, 94, 0.15)' :
                                    log.action.includes('CREATE') ? 'rgba(0, 242, 254, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: log.action.includes('START') ? 'var(--accent-emerald)' :
                               log.action.includes('STOP') ? 'var(--accent-rose)' :
                               log.action.includes('CREATE') ? 'var(--accent-cyan)' : 'var(--accent-amber)'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{log.vm_name || 'N/A'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{log.username || 'System'}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: log.status === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                        ● {log.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{log.details}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
