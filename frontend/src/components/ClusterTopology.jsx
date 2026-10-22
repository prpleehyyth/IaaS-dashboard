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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Maritime Cluster Fleet & Compute Nodes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            Controlling 4 Enterprise Clusters • {totalNodesCount} Bare-Metal Compute Nodes (3 VMware Clusters + 1 Proxmox Cluster)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Cluster Filter Buttons */}
          <div style={{ display: 'flex', background: 'rgba(240, 244, 248, 0.9)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)', gap: '4px' }}>
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
            style={{ padding: '7px 14px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Poll Telemetry</span>
          </button>
        </div>
      </div>

      {/* Cluster Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {filteredClusters.map((cluster) => {
          const isVMware = cluster.type === 'VMWARE';
          const nodes = cluster.nodes || [];

          return (
            <div key={cluster.id} className="glass-panel" style={{ padding: '26px' }}>
              {/* Cluster Title Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', paddingBottom: '18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '12px', 
                    background: isVMware ? '#eff6ff' : '#fff7ed',
                    color: isVMware ? '#1e3a8a' : '#c2410c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${isVMware ? '#bfdbfe' : '#fed7aa'}`
                  }}>
                    <Layers size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{cluster.name}</h2>
                      <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>{cluster.type}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Endpoint: <code style={{ color: '#1e3a8a', fontFamily: 'var(--font-mono)' }}>{cluster.endpoint}</code> • Datacenter: <span style={{ color: 'var(--text-main)' }}>{cluster.datacenter}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>CLUSTER FLEET</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{nodes.length} Physical Nodes</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 14px', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <span className="status-dot online"></span>
                    <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>Fleet Healthy</span>
                  </div>
                </div>
              </div>

              {/* 3 Nodes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {nodes.map((node) => {
                  const ramPct = Math.round((node.ram_usage_gb / node.ram_total_gb) * 100);
                  const storagePct = Math.round((node.storage_usage_gb / node.storage_total_gb) * 100);

                  return (
                    <div 
                      key={node.id} 
                      style={{ 
                        background: 'rgba(240, 244, 248, 0.7)', 
                        border: '1px solid var(--border-subtle)', 
                        borderRadius: '14px', 
                        padding: '20px',
                        transition: 'all 0.25s ease'
                      }}
                      onMouseEnter={(e) => { 
                        e.currentTarget.style.borderColor = '#eff6ff'; 
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(2, 132, 199, 0.08)';
                      }}
                      onMouseLeave={(e) => { 
                        e.currentTarget.style.borderColor = 'var(--border-subtle)'; 
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Node Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Server size={17} color="#1e3a8a" />
                            <span>{node.name}</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#1e3a8a', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            IP: {node.ip_address}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="status-dot ready"></span>
                          <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>{node.status}</span>
                        </div>
                      </div>

                      {/* CPU Model & Uptime */}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{node.cpu_model || 'Xeon Platinum / AMD EPYC'}</div>
                        <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-dim)' }}>
                          <Clock size={12} color="#1e3a8a" />
                          <span>Uptime: <strong style={{ color: 'var(--text-main)' }}>{formatUptime(node.uptime_seconds)}</strong></span>
                        </div>
                      </div>

                      {/* Gauges & Meters */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* CPU Usage */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Cpu size={13} color="#1e3a8a" /> CPU Load ({node.cpu_cores} Cores)
                            </span>
                            <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{node.cpu_usage_pct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(node.cpu_usage_pct, 100)}%`, 
                              height: '100%', 
                              background: node.cpu_usage_pct > 80 ? 'var(--accent-rose)' : 'linear-gradient(90deg, #0f172a, #1e3a8a)' 
                            }}></div>
                          </div>
                        </div>

                        {/* RAM Usage */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Database size={13} color="#1e3a8a" /> RAM Usage
                            </span>
                            <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{node.ram_usage_gb} / {node.ram_total_gb} GB ({ramPct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(ramPct, 100)}%`, 
                              height: '100%', 
                              background: 'linear-gradient(90deg, #1e3a8a, #2563eb)' 
                            }}></div>
                          </div>
                        </div>

                        {/* Storage Pool */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <HardDrive size={13} color="#0f172a" /> Local / SAN Pool
                            </span>
                            <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{node.storage_usage_gb} / {node.storage_total_gb} GB ({storagePct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(storagePct, 100)}%`, 
                              height: '100%', 
                              background: 'linear-gradient(90deg, #0f172a, #1e3a8a)' 
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
