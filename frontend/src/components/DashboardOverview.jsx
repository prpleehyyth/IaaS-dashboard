import React, { useState, useEffect, useCallback } from 'react';
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
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { api } from '../api/client';

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
  const isAdmin = user?.role === 'ADMIN';
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Audit Logs State for Pagination, Filtering, and Export
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(10);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('ALL');
  const [auditStatus, setAuditStatus] = useState('ALL');
  const [auditLoading, setAuditLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const resp = await api.getAuditLogs({
        page: auditPage,
        limit: auditLimit,
        search: auditSearch.trim(),
        action: auditAction,
        status: auditStatus,
      });
      setAuditLogs(resp.logs || []);
      setAuditTotal(resp.total || 0);
    } catch (err) {
      console.warn("Failed to fetch audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditLimit, auditSearch, auditAction, auditStatus]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Export to CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const resp = await api.getAuditLogs({
        export: true,
        search: auditSearch.trim(),
        action: auditAction,
        status: auditStatus,
      });

      const logsToExport = resp.logs || [];
      if (logsToExport.length === 0) {
        alert("Tidak ada data log aktivitas untuk diekspor.");
        return;
      }

      const headers = ['Timestamp', 'Operation Action', 'Target VM Instance', 'Operator User', 'Execution Status', 'Details'];
      const rows = logsToExport.map(l => [
        `"${new Date(l.created_at).toLocaleString('id-ID')}"`,
        `"${l.action || ''}"`,
        `"${l.vm_name || 'N/A'}"`,
        `"${l.username || 'System'}"`,
        `"${l.status || ''}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Gagal mengekspor CSV: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to JSON
  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const resp = await api.getAuditLogs({
        export: true,
        search: auditSearch.trim(),
        action: auditAction,
        status: auditStatus,
      });

      const logsToExport = resp.logs || [];
      if (logsToExport.length === 0) {
        alert("Tidak ada data log aktivitas untuk diekspor.");
        return;
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(logsToExport, null, 2))}`;
      const link = document.createElement('a');
      link.setAttribute('href', jsonString);
      link.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Gagal mengekspor JSON: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAction = async (fn, vm) => {
    if (!fn) return;
    setActionLoadingId(vm.id);
    try {
      await fn(vm);
    } finally {
      setActionLoadingId(null);
      fetchAuditLogs();
    }
  };

  if (!summary) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat metrik infrastruktur cloud...</div>;
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
    clusters = []
  } = summary;

  const vmwareCount = clusters.filter(c => c.type === 'VMWARE').length;
  const proxmoxCount = clusters.filter(c => c.type === 'PROXMOX').length;

  const cpuPct = total_cpu_cores > 0 ? Math.round((allocated_cpu / total_cpu_cores) * 100) : 0;
  const ramPct = total_ram_gb > 0 ? Math.round((allocated_ram_gb / total_ram_gb) * 100) : 0;
  const storageTotalGB = total_storage_tb * 1000;
  const diskPct = storageTotalGB > 0 ? Math.round((allocated_disk_gb / storageTotalGB) * 100) : 0;

  // Pagination calculation
  const totalPages = Math.ceil(auditTotal / auditLimit) || 1;
  const fromRecord = auditTotal > 0 ? (auditPage - 1) * auditLimit + 1 : 0;
  const toRecord = Math.min(auditPage * auditLimit, auditTotal);

  return (
    <div>
      {/* Page Title & Status Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>
            {isAdmin ? 'Infrastructure Command Dashboard' : 'Virtual Machine Operator Dashboard'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            {isAdmin 
              ? `Hybrid Cloud Infrastructure Manager — ${clusters.length} Cluster${clusters.length !== 1 ? 's' : ''} (${vmwareCount} VMware + ${proxmoxCount} Proxmox)`
              : `Panel Operasional VM Delegasi — ${vms.length} Virtual Machine Ditugaskan (${running_vms} Aktif)`}
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          background: (isAdmin ? total_nodes > 0 : vms.length > 0) ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)', 
          border: (isAdmin ? total_nodes > 0 : vms.length > 0) ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(100, 116, 139, 0.25)', 
          padding: '8px 18px', 
          borderRadius: '9999px',
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <span className={`status-dot ${(isAdmin ? total_nodes > 0 : vms.length > 0) ? 'online' : 'stopped'}`}></span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: (isAdmin ? total_nodes > 0 : vms.length > 0) ? '#059669' : 'var(--text-muted)' }}>
            {isAdmin ? `${total_nodes} Compute Node Terdaftar` : `${vms.length} Virtual Machine Ditugaskan`}
          </span>
        </div>
      </div>

      {/* 6 Metric Stat Cards (Role Aware) */}
      <div className="stat-grid">
        {isAdmin ? (
          <>
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
          </>
        ) : (
          <>
            {/* Assigned VMs for Operator */}
            <div className="glass-panel stat-card">
              <div className="stat-icon">
                <HardDrive size={25} />
              </div>
              <div>
                <div className="stat-val">{vms.length}</div>
                <div className="stat-lbl">VM Ditugaskan</div>
                <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                  Delegasi Akses Mandiri
                </div>
              </div>
            </div>

            {/* Running VMs for Operator */}
            <div className="glass-panel stat-card">
              <div className="stat-icon" style={{ color: '#059669', background: '#ecfdf5' }}>
                <Play size={23} />
              </div>
              <div>
                <div className="stat-val" style={{ color: '#059669' }}>{running_vms}</div>
                <div className="stat-lbl">VM Berjalan (Online)</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {stopped_vms} VM dalam status stopped
                </div>
              </div>
            </div>
          </>
        )}

        {/* Total VMs */}
        <div className="glass-panel stat-card">
          <div className="stat-icon">
            <HardDrive size={25} />
          </div>
          <div>
            <div className="stat-val">{isAdmin ? total_vms : vms.length}</div>
            <div className="stat-lbl">{isAdmin ? 'Total Virtual Machines' : 'Status Instansi VM'}</div>
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
              {allocated_cpu} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>{isAdmin ? `/ ${total_cpu_cores} vCPU` : 'vCPU'}</span>
            </div>
            <div className="stat-lbl">{isAdmin ? `vCPU Provisioned (${cpuPct}%)` : 'vCPU Dialokasikan'}</div>
            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', marginTop: '7px' }}>
              <div style={{ width: `${Math.min(cpuPct || 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #0f172a, #1e3a8a)', borderRadius: '3px' }}></div>
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
              {allocated_ram_gb} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>{isAdmin ? `/ ${total_ram_gb} GB` : 'GB'}</span>
            </div>
            <div className="stat-lbl">{isAdmin ? `RAM Allocated (${ramPct}%)` : 'RAM Dialokasikan'}</div>
            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', marginTop: '7px' }}>
              <div style={{ width: `${Math.min(ramPct || 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #1e3a8a, #2563eb)', borderRadius: '3px' }}></div>
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
              {allocated_disk_gb} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>{isAdmin ? `/ ${Math.round(storageTotalGB)} GB` : 'GB Disk'}</span>
            </div>
            <div className="stat-lbl">{isAdmin ? `Storage Pool (${diskPct}%)` : 'Storage Dialokasikan'}</div>
            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', marginTop: '7px' }}>
              <div style={{ width: `${Math.min(diskPct || 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #0f172a, #1e3a8a)', borderRadius: '3px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Quick Cards (ONLY VISIBLE FOR ADMIN) */}
      {isAdmin && (
        <div style={{ marginBottom: '34px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Infrastruktur Cluster</h2>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('clusters')}
            >
              <span>Periksa Semua Node ({total_nodes})</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {clusters.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <Layers size={40} color="var(--text-dim)" style={{ margin: '0 auto 14px auto' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                Belum Ada Hypervisor Cluster yang Terhubung
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 20px auto' }}>
                Hubungkan cluster bare-metal Proxmox VE atau VMware vSphere pada tab Clusters untuk mulai memonitor hardware dan memprovision VM.
              </p>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => onNavigateTab('clusters')}
              >
                <Layers size={15} />
                <span>Hubungkan Cluster Pertama</span>
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
      )}

      {/* Live VM Resource Monitoring & Quick Controls */}
      <div style={{ marginBottom: '34px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {isAdmin ? 'Direct Resource Monitoring & Quick Controls' : 'Virtual Machine yang Ditugaskan'}
              </h2>
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
                Live VM Telemetry
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
            <span>Buka Manajemen VM</span>
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
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '38px 20px' }}>
                    <HardDrive size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px auto' }} />
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem', marginBottom: '4px' }}>
                      {isAdmin ? 'Belum ada virtual machine yang dideploy.' : 'Belum ada virtual machine yang ditugaskan kepada Anda.'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {isAdmin ? 'Deploy VM baru melalui menu Virtual Machines.' : 'Hubungi Administrator untuk memberikan akses tugas VM.'}
                    </div>
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
                          {isRunning ? (
                            <>
                              <button 
                                className="btn btn-secondary btn-sm"
                                title="Matikan VM (Power Off)"
                                onClick={() => handleAction(onStopVM, vm)}
                                disabled={isLoading}
                                style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}
                              >
                                {isLoading ? <RotateCw size={12} className="spin" /> : <Square size={12} fill="#dc2626" />}
                                <span>Stop</span>
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm"
                                title="Reboot OS VM"
                                onClick={() => handleAction(onRestartVM, vm)}
                                disabled={isLoading}
                              >
                                <RotateCw size={12} className={isLoading ? 'spin' : ''} />
                                <span>Reboot</span>
                              </button>
                            </>
                          ) : (
                            <button 
                              className="btn btn-secondary btn-sm"
                              title="Nyalakan VM (Power On)"
                              onClick={() => handleAction(onStartVM, vm)}
                              disabled={isLoading}
                              style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                            >
                              {isLoading ? <RotateCw size={12} className="spin" /> : <Play size={12} fill="#059669" />}
                              <span>Start</span>
                            </button>
                          )}

                          <button
                            className="btn btn-secondary btn-sm"
                            title="Instalasi Ulang OS (Rebuild)"
                            onClick={() => onOpenRebuildModal && onOpenRebuildModal(vm)}
                            style={{ color: '#1e3a8a', borderColor: '#bfdbfe', background: '#eff6ff' }}
                          >
                            <Disc size={12} />
                            <span>Rebuild</span>
                          </button>

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

      {/* Control Plane Real-time Audit Trail (PAGINASI, FILTER & EKSPOR) */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Control Plane Real-time Audit Trail</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Catatan audit operasional telemetri dengan pagination, filter, dan fitur ekspor CSV/JSON
            </span>
          </div>

          {/* Action Buttons: Export CSV & JSON + Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              disabled={isExporting || auditTotal === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              title="Ekspor seluruh log audit yang sesuai filter ke file CSV"
            >
              <FileSpreadsheet size={14} color="#059669" />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor CSV'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportJSON}
              disabled={isExporting || auditTotal === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              title="Ekspor seluruh log audit ke file JSON"
            >
              <FileCode size={14} color="#1e3a8a" />
              <span>Ekspor JSON</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchAuditLogs}
              disabled={auditLoading}
              style={{ padding: '6px 10px' }}
              title="Muat ulang log aktivitas audit"
            >
              <RefreshCw size={13} className={auditLoading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={15} color="#1e3a8a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Cari berdasarkan instance VM, operator, atau detail..."
              className="form-input"
              style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value);
                setAuditPage(1);
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Filter Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Operasi:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
                value={auditAction}
                onChange={(e) => {
                  setAuditAction(e.target.value);
                  setAuditPage(1);
                }}
              >
                <option value="ALL">Semua Operasi</option>
                <option value="START_VM">START_VM</option>
                <option value="STOP_VM">STOP_VM</option>
                <option value="RESTART_VM">RESTART_VM</option>
                <option value="REBUILD_VM">REBUILD_VM</option>
                <option value="CREATE_VM">CREATE_VM</option>
                <option value="EDIT_VM">EDIT_VM</option>
                <option value="DELETE_VM">DELETE_VM</option>
                <option value="OPEN_CONSOLE">OPEN_CONSOLE</option>
              </select>
            </div>

            {/* Filter Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
                value={auditStatus}
                onChange={(e) => {
                  setAuditStatus(e.target.value);
                  setAuditPage(1);
                }}
              >
                <option value="ALL">Semua Status</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            {/* Items Per Page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Per Halaman:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }}
                value={auditLimit}
                onChange={(e) => {
                  setAuditLimit(parseInt(e.target.value, 10));
                  setAuditPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Operasi</th>
                <th>Target Instance</th>
                <th>Operator</th>
                <th>Status Eksekusi</th>
                <th>Detail Aktivitas</th>
                <th>Waktu (Timestamp)</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto', color: '#1e3a8a' }} />
                    <div style={{ fontSize: '0.85rem' }}>Memuat data log audit...</div>
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px' }}>
                    Tidak ada catatan aktivitas audit yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => {
                  const isStart = (log.action || '').includes('START');
                  const isStop = (log.action || '').includes('STOP');
                  const isCreate = (log.action || '').includes('CREATE');
                  const isRebuild = (log.action || '').includes('REBUILD');
                  const isConsole = (log.action || '').includes('CONSOLE');

                  return (
                    <tr key={log.id}>
                      <td>
                        <span style={{ 
                          fontSize: '0.74rem', 
                          fontWeight: 700, 
                          padding: '3px 9px', 
                          borderRadius: '5px',
                          background: isStart ? '#ecfdf5' :
                                      isStop ? '#fef2f2' :
                                      isCreate ? '#eff6ff' :
                                      isRebuild ? '#fef3c7' :
                                      isConsole ? '#f0fdf4' : '#f8fafc',
                          color: isStart ? '#059669' :
                                 isStop ? '#dc2626' :
                                 isCreate ? '#1e3a8a' :
                                 isRebuild ? '#d97706' :
                                 isConsole ? '#047857' : '#475569',
                          border: isStart ? '1px solid #a7f3d0' :
                                  isStop ? '1px solid #fecaca' :
                                  isCreate ? '1px solid #bfdbfe' :
                                  isRebuild ? '1px solid #fde68a' : '1px solid var(--border-subtle)'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>{log.vm_name || 'N/A'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{log.username || 'System'}</td>
                      <td>
                        <span style={{ 
                          fontSize: '0.78rem', 
                          fontWeight: 700, 
                          color: log.status === 'SUCCESS' ? '#059669' : '#dc2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span>●</span> {log.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{log.details}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginTop: '14px', 
          padding: '10px 14px',
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Menampilkan <strong style={{ color: 'var(--text-main)' }}>{fromRecord} - {toRecord}</strong> dari <strong style={{ color: '#1e3a8a' }}>{auditTotal}</strong> aktivitas
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAuditPage(p => Math.max(p - 1, 1))}
              disabled={auditPage <= 1 || auditLoading}
              style={{ padding: '5px 10px', fontSize: '0.8rem' }}
            >
              <ChevronLeft size={14} />
              <span>Sebelumnya</span>
            </button>

            <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 700, padding: '0 8px' }}>
              Halaman {auditPage} dari {totalPages}
            </span>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAuditPage(p => Math.min(p + 1, totalPages))}
              disabled={auditPage >= totalPages || auditLoading}
              style={{ padding: '5px 10px', fontSize: '0.8rem' }}
            >
              <span>Berikutnya</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
