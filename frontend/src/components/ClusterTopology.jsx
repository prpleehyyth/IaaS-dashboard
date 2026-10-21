import React, { useState } from 'react';
import { 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Network,
  RefreshCw
} from 'lucide-react';

export default function ClusterTopology({ clusters, onRefresh }) {
  const [selectedClusterFilter, setSelectedClusterFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredClusters = selectedClusterFilter === 'ALL' 
    ? clusters 
    : clusters.filter(c => c.id === selectedClusterFilter);

  const totalNodesCount = clusters.reduce((acc, c) => acc + (c.nodes?.length || 0), 0);

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  return (
    <div>
      {/* Header and Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>Cluster Topology & Node Fleet</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Controlling 4 Enterprise Clusters • {totalNodesCount} Bare-Metal Compute Nodes (3 VMware Clusters + 1 Proxmox Cluster)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Cluster Filter Buttons */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)', gap: '4px' }}>
            <button
              className={`btn btn-sm ${selectedClusterFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedClusterFilter('ALL')}
            >
              All Clusters ({clusters.length})
            </button>
            {clusters.map(c => (
              <button
                key={c.id}
                className={`btn btn-sm ${selectedClusterFilter === c.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedClusterFilter(c.id)}
              >
                {c.name.split(' ')[0]} {c.name.split(' ')[1] || ''}
              </button>
            ))}
          </div>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            title="Refresh Node Telemetry"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Poll Nodes</span>
          </button>
        </div>
      </div>

      {/* Cluster Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {filteredClusters.map((cluster) => {
          const isVMware = cluster.type === 'VMWARE';
          const nodes = cluster.nodes || [];

          return (
            <div key={cluster.id} className="glass-panel" style={{ padding: '24px' }}>
              {/* Cluster Title Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '10px', 
                    background: isVMware ? 'rgba(2, 132, 199, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                    color: isVMware ? 'var(--vmware-blue)' : 'var(--proxmox-orange)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${isVMware ? 'rgba(2, 132, 199, 0.4)' : 'rgba(249, 115, 22, 0.4)'}`
                  }}>
                    <Layers size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{cluster.name}</h2>
                      <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>{cluster.type}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      Endpoint: <code style={{ color: 'var(--text-muted)' }}>{cluster.endpoint}</code> • Region: {cluster.datacenter}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>CLUSTER NODES</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{nodes.length} Physical Nodes</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <span className="status-dot online"></span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>Cluster Healthy</span>
                  </div>
                </div>
              </div>

              {/* 3 Nodes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                {nodes.map((node) => {
                  const ramPct = Math.round((node.ram_usage_gb / node.ram_total_gb) * 100);
                  const storagePct = Math.round((node.storage_usage_gb / node.storage_total_gb) * 100);

                  return (
                    <div 
                      key={node.id} 
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border-subtle)', 
                        borderRadius: '12px', 
                        padding: '18px',
                        transition: 'transform 0.2s, border-color 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                    >
                      {/* Node Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Server size={16} color="var(--accent-cyan)" />
                            <span>{node.name}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            IP: {node.ip_address}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className="status-dot ready"></span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>{node.status}</span>
                        </div>
                      </div>

                      {/* CPU Model & Uptime */}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '14px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                        <div>{node.cpu_model || 'Xeon Platinum / EPYC'}</div>
                        <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          <span>Uptime: {formatUptime(node.uptime_seconds)}</span>
                        </div>
                      </div>

                      {/* Gauges & Meters */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* CPU Usage */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Cpu size={13} /> CPU Load ({node.cpu_cores} Cores)
                            </span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{node.cpu_usage_pct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(node.cpu_usage_pct, 100)}%`, 
                              height: '100%', 
                              background: node.cpu_usage_pct > 80 ? 'var(--accent-rose)' : 'linear-gradient(90deg, #00f2fe, #3b82f6)' 
                            }}></div>
                          </div>
                        </div>

                        {/* RAM Usage */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Database size={13} /> RAM Usage
                            </span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{node.ram_usage_gb} / {node.ram_total_gb} GB ({ramPct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(ramPct, 100)}%`, 
                              height: '100%', 
                              background: 'linear-gradient(90deg, #10b981, #34d399)' 
                            }}></div>
                          </div>
                        </div>

                        {/* Storage Pool */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <HardDrive size={13} /> Local/SAN Storage
                            </span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{node.storage_usage_gb} / {node.storage_total_gb} GB ({storagePct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(storagePct, 100)}%`, 
                              height: '100%', 
                              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' 
                            }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
