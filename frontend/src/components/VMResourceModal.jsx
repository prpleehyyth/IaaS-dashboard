import React, { useState, useEffect } from 'react';
import { X, Activity, Cpu, Database, HardDrive, Wifi, Clock, Server, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

export default function VMResourceModal({ vm, onClose }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTelemetry = async () => {
    if (!vm) return;
    try {
      const data = await api.getVMTelemetry(vm.id);
      setTelemetry(data);
      setError('');
    } catch (err) {
      console.warn('Telemetry fetch error:', err);
      setError(err.message || 'Gagal memuat telemetri resource VM');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    if (!autoRefresh) return;
    const interval = setInterval(fetchTelemetry, 3500);
    return () => clearInterval(interval);
  }, [vm, autoRefresh]);

  const isRunning = vm?.status === 'RUNNING';
  const cpuPct = telemetry?.cpu_usage_pct || 0;
  const ramPct = telemetry?.ram_usage_pct || 0;
  const diskPct = telemetry?.disk_usage_pct || 0;

  const formatUptime = (seconds) => {
    if (!seconds || seconds <= 0) return 'Nonaktif / Stopped';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs} jam ${mins} mnt ${secs} dtk`;
    if (mins > 0) return `${mins} mnt ${secs} dtk`;
    return `${secs} detik`;
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '10px', 
              background: isRunning ? '#ecfdf5' : '#f1f5f9', 
              border: `1px solid ${isRunning ? '#a7f3d0' : 'var(--border-subtle)'}`,
              color: isRunning ? '#059669' : 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={20} className={isRunning ? 'spin' : ''} style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Live Resource Telemetry</h2>
                <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isRunning ? '#059669' : 'var(--text-dim)' }}>
                  {vm?.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                VM: <strong style={{ color: 'var(--text-main)' }}>{vm?.name}</strong> • Node: <strong style={{ color: '#1e3a8a' }}>{vm?.node_name || vm?.node_id}</strong>
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: '16px' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Live Gauges Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          {/* CPU Usage Gauge */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <Cpu size={15} color="#1e3a8a" />
                <span>CPU UTILIZATION</span>
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: cpuPct > 80 ? '#dc2626' : '#1e3a8a' }}>
                {isRunning ? `${cpuPct}%` : '0%'}
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
              {vm?.cpu_cores} vCPU Core{vm?.cpu_cores !== 1 ? 's' : ''} dialokasikan
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${isRunning ? Math.min(cpuPct, 100) : 0}%`, 
                height: '100%', 
                background: cpuPct > 80 ? '#dc2626' : 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
                borderRadius: '4px',
                transition: 'width 0.5s ease'
              }}></div>
            </div>
          </div>

          {/* RAM Usage Gauge */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <Database size={15} color="#1e3a8a" />
                <span>MEMORY (RAM)</span>
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: ramPct > 85 ? '#dc2626' : '#0f172a' }}>
                {isRunning ? `${ramPct}%` : '0%'}
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
              {isRunning ? `${telemetry?.ram_usage_mb || 0} MB` : '0 MB'} / {vm?.ram_mb} MB ({Math.round((vm?.ram_mb || 0) / 1024)} GB)
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${isRunning ? Math.min(ramPct, 100) : 0}%`, 
                height: '100%', 
                background: ramPct > 85 ? '#dc2626' : 'linear-gradient(90deg, #0f172a, #2563eb)',
                borderRadius: '4px',
                transition: 'width 0.5s ease'
              }}></div>
            </div>
          </div>

          {/* Storage Usage Gauge */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <HardDrive size={15} color="#1e3a8a" />
                <span>STORAGE DRIVE</span>
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e3a8a' }}>
                {diskPct}%
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
              {telemetry?.disk_usage_gb || (vm?.disk_gb ? (vm.disk_gb * 0.35).toFixed(1) : 0)} GB terpakai dari {vm?.disk_gb} GB
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${Math.min(diskPct, 100)}%`, 
                height: '100%', 
                background: 'linear-gradient(90deg, #0f172a, #1e3a8a)',
                borderRadius: '4px'
              }}></div>
            </div>
          </div>

          {/* Network I/O Telemetry */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <Wifi size={15} color="#1e3a8a" />
                <span>NETWORK TRAFFIC</span>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
                {isRunning ? 'Connected' : 'Offline'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '6px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Net Inbound (RX):</span>
              <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{formatBytes(telemetry?.net_in_bytes)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '4px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Net Outbound (TX):</span>
              <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{formatBytes(telemetry?.net_out_bytes)}</strong>
            </div>
          </div>
        </div>

        {/* System Uptime & Identity Footer */}
        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid var(--border-subtle)', 
          padding: '14px 16px', 
          borderRadius: '10px', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="#1e3a8a" />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>SYSTEM UPTIME</div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {formatUptime(telemetry?.uptime_seconds)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={autoRefresh} 
                onChange={(e) => setAutoRefresh(e.target.checked)} 
              />
              <span>Auto-refresh (3.5s)</span>
            </label>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={fetchTelemetry}
              disabled={loading}
              title="Perbarui telemetri sekarang"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Footer Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Tutup Monitor
          </button>
        </div>
      </div>
    </div>
  );
}
