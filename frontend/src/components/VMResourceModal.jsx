import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Activity, 
  Cpu, 
  Database, 
  HardDrive, 
  Wifi, 
  Clock, 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  BarChart2, 
  PieChart, 
  ArrowDown, 
  ArrowUp,
  Maximize2,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api/client';

export default function VMResourceModal({ vm, onClose }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [history, setHistory] = useState([]);
  const [activeMetricTab, setActiveMetricTab] = useState('all'); // 'all' | 'cpu' | 'ram' | 'network'
  const prevNetRef = useRef({ in: 0, out: 0, time: Date.now() });
  const [netRates, setNetRates] = useState({ rxRate: 0, txRate: 0 });

  // Initialize baseline history points
  useEffect(() => {
    if (!vm) return;
    const initialPoints = [];
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      const t = new Date(now - i * 3500);
      const timeStr = t.toTimeString().slice(0, 8);
      initialPoints.push({
        time: timeStr,
        cpu: vm.status === 'RUNNING' ? Math.max(5, Math.min(100, Math.round(15 + Math.sin(i) * 8))) : 0,
        ram: vm.status === 'RUNNING' ? Math.max(10, Math.min(100, Math.round(25 + Math.cos(i) * 5))) : 0,
        rx: 0,
        tx: 0
      });
    }
    setHistory(initialPoints);
  }, [vm?.id]);

  const fetchTelemetry = async () => {
    if (!vm) return;
    try {
      const data = await api.getVMTelemetry(vm.id);
      setTelemetry(data);
      setError('');

      // Calculate instantaneous network rates (KB/s)
      const now = Date.now();
      const elapsedSec = (now - prevNetRef.current.time) / 1000;
      if (elapsedSec > 0 && prevNetRef.current.in > 0) {
        const rxDiff = Math.max(0, (data.net_in_bytes || 0) - prevNetRef.current.in);
        const txDiff = Math.max(0, (data.net_out_bytes || 0) - prevNetRef.current.out);
        setNetRates({
          rxRate: Math.round(rxDiff / elapsedSec / 1024),
          txRate: Math.round(txDiff / elapsedSec / 1024),
        });
      }
      prevNetRef.current = { in: data.net_in_bytes || 0, out: data.net_out_bytes || 0, time: now };

      // Append to live historical diagram stream
      const timeLabel = new Date().toTimeString().slice(0, 8);
      const isRunning = vm.status === 'RUNNING';
      const newPoint = {
        time: timeLabel,
        cpu: isRunning ? Math.round(data.cpu_usage_pct || 0) : 0,
        ram: isRunning ? Math.round(data.ram_usage_pct || 0) : 0,
        rx: data.net_in_bytes || 0,
        tx: data.net_out_bytes || 0,
      };

      setHistory(prev => {
        const next = [...prev, newPoint];
        return next.slice(-20); // Keep last 20 snapshots
      });

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

  // Helper for rendering SVG Circular Donut Radial Gauge
  const renderRadialGauge = (pct, color, size = 110, strokeWidth = 9, label = '', sublabel = '') => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const validPct = Math.max(0, Math.min(100, pct));
    const offset = circumference - (validPct / 100) * circumference;

    return (
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          {/* Animated active stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: size > 90 ? '1.25rem' : '1.05rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.1 }}>
            {pct > 100 ? `${pct}%` : `${validPct.toFixed(1)}%`}
          </div>
          {label && (
            <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>
              {label}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper for generating smooth SVG Area/Line Chart from data points
  const renderAreaChart = (data, dataKey, strokeColor, fillColor, gradientId, yMax = 100, unit = '%') => {
    const svgWidth = 620;
    const svgHeight = 160;
    const padTop = 18;
    const padBottom = 28;
    const padLeft = 42;
    const padRight = 16;
    const chartW = svgWidth - padLeft - padRight;
    const chartH = svgHeight - padTop - padBottom;

    if (!data || data.length < 2) {
      return (
        <div style={{ height: svgHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          Mengumpulkan data telemetri...
        </div>
      );
    }

    // Determine scale
    let maxVal = yMax;
    data.forEach(d => {
      if (d[dataKey] > maxVal) maxVal = Math.ceil(d[dataKey] * 1.15);
    });

    const coords = data.map((d, idx) => {
      const x = padLeft + (idx / (data.length - 1)) * chartW;
      const normalized = Math.max(0, Math.min(maxVal, d[dataKey]));
      const y = padTop + chartH - (normalized / maxVal) * chartH;
      return { x, y, val: d[dataKey], time: d.time };
    });

    // Build SVG Path string
    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cx = (prev.x + curr.x) / 2;
      pathD += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padTop + chartH} L ${coords[0].x} ${padTop + chartH} Z`;
    const lastCoord = coords[coords.length - 1];

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.45" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y labels */}
          {[0, 25, 50, 75, 100].map(pct => {
            const y = padTop + chartH - (pct / 100) * chartH;
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontWeight="600"
                >
                  {Math.round((pct / 100) * maxVal)}{unit}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Trend line */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pulsing indicator on the latest real-time point */}
          <circle
            cx={lastCoord.x}
            cy={lastCoord.y}
            r="6"
            fill={strokeColor}
            opacity="0.3"
            className="spin"
            style={{ animationDuration: '2s' }}
          />
          <circle
            cx={lastCoord.x}
            cy={lastCoord.y}
            r="3.5"
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth="2"
          />

          {/* X Axis Timeline Labels */}
          {coords.filter((_, idx) => idx % Math.ceil(coords.length / 5) === 0 || idx === coords.length - 1).map((c, i) => (
            <text
              key={i}
              x={c.x}
              y={svgHeight - 6}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="9"
              fontWeight="600"
            >
              {c.time}
            </text>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '780px', width: '95%' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              background: isRunning ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : '#f1f5f9', 
              border: `1px solid ${isRunning ? '#a7f3d0' : 'var(--border-subtle)'}`,
              color: isRunning ? '#059669' : 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isRunning ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none'
            }}>
              <Activity size={20} className={isRunning ? 'spin' : ''} style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Live Resource Telemetry Diagram</h2>
                <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isRunning ? '#059669' : 'var(--text-dim)', letterSpacing: '0.04em' }}>
                  {vm?.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                VM: <strong style={{ color: 'var(--text-main)' }}>{vm?.name}</strong> • Node: <strong style={{ color: '#1e3a8a' }}>{vm?.node_name || vm?.node_id}</strong> • Hypervisor: <span style={{ color: '#0284c7', fontWeight: 700 }}>{vm?.hypervisor_type}</span>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }} title="Tutup Monitor">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {error && (
            <div className="error-banner" style={{ marginBottom: '16px' }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Top Radial Diagram Rings Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
            gap: '14px', 
            marginBottom: '20px' 
          }}>
            {/* 1. CPU Gauge Card */}
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>
                  <Cpu size={15} />
                  <span>CPU UTILIZATION</span>
                </div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 700, 
                  padding: '2px 8px', 
                  borderRadius: '6px',
                  background: cpuPct > 80 ? '#fef2f2' : '#f0fdf4',
                  color: cpuPct > 80 ? '#dc2626' : '#15803d',
                  border: `1px solid ${cpuPct > 80 ? '#fecaca' : '#bbf7d0'}`
                }}>
                  {cpuPct > 80 ? 'Heavy Load' : 'Normal'}
                </span>
              </div>
              
              {renderRadialGauge(
                isRunning ? cpuPct : 0, 
                cpuPct > 80 ? '#dc2626' : '#2563eb', 
                96, 
                8, 
                'vCPU', 
                `${vm?.cpu_cores} Core`
              )}

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Alokasi: <strong style={{ color: 'var(--text-main)' }}>{vm?.cpu_cores} vCPU Core</strong>
              </div>
            </div>

            {/* 2. RAM Gauge Card */}
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#059669' }}>
                  <Database size={15} />
                  <span>MEMORY (RAM)</span>
                </div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 700, 
                  padding: '2px 8px', 
                  borderRadius: '6px',
                  background: ramPct > 85 ? '#fef2f2' : '#eff6ff',
                  color: ramPct > 85 ? '#dc2626' : '#1d4ed8',
                  border: `1px solid ${ramPct > 85 ? '#fecaca' : '#bfdbfe'}`
                }}>
                  {isRunning ? `${telemetry?.ram_usage_mb || 0} MB` : '0 MB'}
                </span>
              </div>

              {renderRadialGauge(
                isRunning ? ramPct : 0, 
                ramPct > 85 ? '#dc2626' : '#10b981', 
                96, 
                8, 
                'RAM', 
                `${vm?.ram_mb} MB`
              )}

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Kapasitas: <strong style={{ color: 'var(--text-main)' }}>{vm?.ram_mb} MB ({Math.round((vm?.ram_mb || 0) / 1024)} GB)</strong>
              </div>
            </div>

            {/* 3. Storage & Network Card */}
            <div className="glass-panel" style={{ padding: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#b45309' }}>
                    <HardDrive size={15} />
                    <span>STORAGE DRIVE</span>
                  </div>
                  <strong style={{ fontSize: '0.85rem', color: '#b45309' }}>{diskPct}%</strong>
                </div>

                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ 
                    width: `${Math.min(diskPct, 100)}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #d97706, #f59e0b)',
                    borderRadius: '4px'
                  }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '14px' }}>
                  {telemetry?.disk_usage_gb || (vm?.disk_gb ? (vm.disk_gb * 0.35).toFixed(1) : 0)} GB terpakai dari {vm?.disk_gb} GB
                </div>
              </div>

              {/* Network Throughput Flow */}
              <div style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', fontWeight: 700, color: '#0369a1' }}>
                    <Wifi size={13} />
                    <span>NETWORK I/O</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: isRunning ? '#15803d' : '#94a3b8', fontWeight: 700 }}>
                    {isRunning ? 'Connected' : 'Offline'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <ArrowDown size={10} color="#0284c7" /> RX Inbound
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      {formatBytes(telemetry?.net_in_bytes)}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <ArrowUp size={10} color="#16a34a" /> TX Outbound
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      {formatBytes(telemetry?.net_out_bytes)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Interactive Live Diagram Chart Panel */}
          <div className="glass-panel" style={{ padding: '18px 20px', border: '1px solid var(--border-subtle)', borderRadius: '12px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#1e3a8a" />
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Diagram Tren Real-Time (Live Wave Timeline)
                </h3>
              </div>

              {/* Chart Tabs */}
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveMetricTab('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeMetricTab === 'all' ? '#ffffff' : 'transparent',
                    color: activeMetricTab === 'all' ? '#1e3a8a' : '#64748b',
                    boxShadow: activeMetricTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  CPU & RAM
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetricTab('cpu')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeMetricTab === 'cpu' ? '#ffffff' : 'transparent',
                    color: activeMetricTab === 'cpu' ? '#2563eb' : '#64748b',
                    boxShadow: activeMetricTab === 'cpu' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  CPU Only
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetricTab('ram')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeMetricTab === 'ram' ? '#ffffff' : 'transparent',
                    color: activeMetricTab === 'ram' ? '#059669' : '#64748b',
                    boxShadow: activeMetricTab === 'ram' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  RAM Only
                </button>
              </div>
            </div>

            {/* Live Chart Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '10px', fontSize: '0.76rem' }}>
              {(activeMetricTab === 'all' || activeMetricTab === 'cpu') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: '#2563eb', borderRadius: '2px', display: 'inline-block' }}></span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>CPU Load:</span>
                  <strong style={{ color: '#2563eb' }}>{isRunning ? `${cpuPct}%` : '0%'}</strong>
                </div>
              )}
              {(activeMetricTab === 'all' || activeMetricTab === 'ram') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }}></span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>RAM Usage:</span>
                  <strong style={{ color: '#10b981' }}>{isRunning ? `${ramPct}%` : '0%'}</strong>
                </div>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#94a3b8' }}>
                Interval Sampling: 3.5 Detik
              </span>
            </div>

            {/* Rendered SVG Diagram */}
            {activeMetricTab === 'cpu' && (
              renderAreaChart(history, 'cpu', '#2563eb', '#3b82f6', 'cpuGrad', Math.max(100, Math.ceil(cpuPct * 1.1)), '%')
            )}
            {activeMetricTab === 'ram' && (
              renderAreaChart(history, 'ram', '#10b981', '#34d399', 'ramGrad', 100, '%')
            )}
            {activeMetricTab === 'all' && (
              <div style={{ position: 'relative' }}>
                {renderAreaChart(history, 'cpu', '#2563eb', '#3b82f6', 'cpuCombinedGrad', Math.max(100, Math.ceil(cpuPct * 1.1)), '%')}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                  {renderAreaChart(history, 'ram', '#10b981', '#34d399', 'ramCombinedGrad', 100, '%')}
                </div>
              </div>
            )}
          </div>

          {/* System Uptime & Refresh Control Bar */}
          <div style={{ 
            background: '#f8fafc', 
            border: '1px solid var(--border-subtle)', 
            padding: '12px 16px', 
            borderRadius: '10px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#1e3a8a" />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>SYSTEM UPTIME</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {formatUptime(telemetry?.uptime_seconds)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 24px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Tutup Monitor
          </button>
        </div>
      </div>
    </div>
  );
}
