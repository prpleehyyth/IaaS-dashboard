import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  Plus, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  ShieldCheck, 
  Key, 
  Wifi, 
  Clock, 
  X,
  Play,
  RotateCcw
} from 'lucide-react';
import { api } from '../api/client';

export default function ClusterDetail({ 
  clusterId, 
  user, 
  onBack, 
  onNavigateVM, 
  onRefresh, 
  showToast 
}) {
  const [cluster, setCluster] = useState(null);
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [activeTab, setActiveTab] = useState('nodes'); // 'nodes' | 'vms' | 'capacity' | 'settings'

  // Add Node Modal State
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [nodeId, setNodeId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeIP, setNodeIP] = useState('');
  const [cpuModel, setCpuModel] = useState('Intel Xeon Gold / AMD EPYC');
  const [cpuCores, setCpuCores] = useState(32);
  const [ramGB, setRamGB] = useState(256);
  const [storageGB, setStorageGB] = useState(4000);
  const [isSubmittingNode, setIsSubmittingNode] = useState(false);
  const [nodeError, setNodeError] = useState('');

  const isAdmin = user?.role === 'ADMIN' || api.isAdmin();

  const loadClusterData = async () => {
    try {
      const [clusterData, allVMs] = await Promise.all([
        api.getCluster(clusterId),
        api.getVMs().catch(() => [])
      ]);

      setCluster(clusterData);
      // Filter VMs hosted on this cluster
      const clusterVMs = (allVMs || []).filter(v => v.cluster_id === clusterId);
      setVms(clusterVMs);
    } catch (err) {
      console.error('Failed to load cluster detail:', err);
      if (showToast) showToast('Gagal memuat detail cluster: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clusterId) {
      setLoading(true);
      loadClusterData();
    }
  }, [clusterId]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.syncCluster(cluster.id);
      if (showToast) showToast(`Cluster '${cluster.name}' berhasil disinkronkan dengan hypervisor`);
      await loadClusterData();
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast('Sinkronisasi gagal: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testClusterConnection({
        cluster_id: cluster.id,
        type: cluster.type,
        endpoint: cluster.endpoint,
        auth_user: cluster.auth_user,
        auth_secret: cluster.auth_secret || '',
        insecure_ssl: cluster.insecure_ssl,
      });
      setTestResult(res);
      if (showToast) showToast(res.message || 'Koneksi ke hypervisor berhasil diverifikasi', 'success');
    } catch (err) {
      setTestResult({ success: false, message: err.message });
      if (showToast) showToast('Verifikasi koneksi gagal: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateNode = async (e) => {
    e.preventDefault();
    setNodeError('');
    setIsSubmittingNode(true);

    try {
      await api.addNode(cluster.id, {
        id: nodeId.trim() || undefined,
        name: nodeName.trim(),
        ip_address: nodeIP.trim(),
        cpu_model: cpuModel.trim(),
        cpu_cores: parseInt(cpuCores, 10),
        ram_total_gb: parseInt(ramGB, 10),
        storage_total_gb: parseInt(storageGB, 10),
      });

      if (showToast) showToast(`Host '${nodeName}' berhasil ditambahkan ke cluster`);
      setIsAddNodeOpen(false);
      setNodeId('');
      setNodeName('');
      setNodeIP('');
      await loadClusterData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setNodeError(err.message || 'Gagal menambahkan host');
    } finally {
      setIsSubmittingNode(false);
    }
  };

  const handleDeleteNode = async (node) => {
    if (!window.confirm(`Yakin ingin menghapus Host '${node.name}' (${node.ip_address}) dari cluster?`)) {
      return;
    }

    try {
      await api.deleteNode(cluster.id, node.id);
      if (showToast) showToast(`Host '${node.name}' berhasil dihapus`);
      await loadClusterData();
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast('Gagal menghapus host: ' + err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto', color: 'var(--ocean-blue)' }} />
        <div style={{ fontWeight: 600 }}>Memuat informasi detail Cluster & Host...</div>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
        <AlertCircle size={36} color="#dc2626" style={{ margin: '0 auto 12px auto' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
          Cluster Tidak Ditemukan
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Cluster mungkin telah dihapus atau tidak dapat diakses.
        </p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Kembali ke Daftar Cluster & Host</span>
        </button>
      </div>
    );
  }

  const isVMware = cluster.type === 'VMWARE';
  const nodes = cluster.nodes || [];

  // Aggregated capacity calculations
  const totalCores = nodes.reduce((sum, n) => sum + (n.cpu_cores || 0), 0) || cluster.total_cpu_cores || 0;
  const totalRAM = nodes.reduce((sum, n) => sum + (n.ram_total_gb || 0), 0) || cluster.total_ram_gb || 0;
  const totalStorageGB = nodes.reduce((sum, n) => sum + (n.storage_total_gb || 0), 0) || Math.round((cluster.total_storage_tb || 0) * 1024);

  const usedCores = vms.reduce((sum, v) => sum + (v.cpu_cores || 0), 0);
  const usedRAMGB = Math.round(vms.reduce((sum, v) => sum + (v.ram_mb || 0), 0) / 1024);
  const usedStorageGB = vms.reduce((sum, v) => sum + (v.disk_gb || 0), 0);

  const cpuPct = totalCores > 0 ? Math.round((usedCores / totalCores) * 100) : 0;
  const ramPct = totalRAM > 0 ? Math.round((usedRAMGB / totalRAM) * 100) : 0;
  const storagePct = totalStorageGB > 0 ? Math.round((usedStorageGB / totalStorageGB) * 100) : 0;

  return (
    <div>
      {/* Top Breadcrumb & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Daftar Cluster</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
            <span>/</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{cluster.name}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleTestConnection}
            disabled={isTesting}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={14} />
            <span>{isTesting ? 'Menguji Koneksi...' : 'Test Koneksi API'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSync}
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e3a8a', borderColor: '#bfdbfe', background: '#eff6ff' }}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sync Cluster'}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddNodeOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Tambah Host Fisik</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="glass-panel" style={{ padding: '24px 28px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '54px', 
              height: '54px', 
              borderRadius: '14px', 
              background: isVMware ? 'rgba(30, 58, 138, 0.08)' : 'rgba(234, 88, 12, 0.08)',
              color: isVMware ? '#1e3a8a' : '#c2410c',
              border: isVMware ? '1px solid #bfdbfe' : '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Server size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {cluster.name}
                </h1>
                <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>
                  {cluster.type}
                </span>
                <span style={{ 
                  fontSize: '0.74rem', 
                  background: '#ecfdf5', 
                  border: '1px solid #a7f3d0', 
                  color: '#065f46', 
                  padding: '2px 8px', 
                  borderRadius: '6px', 
                  fontWeight: 700 
                }}>
                  {cluster.status || 'ONLINE'}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px', margin: 0 }}>
                Datacenter: <strong>{cluster.datacenter || 'DC-MAIN'}</strong> • Endpoint: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{cluster.endpoint}</code>
              </p>
            </div>
          </div>

          {/* Quick Aggregate Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Host Fisik Online</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a' }}>{nodes.length} Nodes</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Virtual Machines</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{vms.length} VMs</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Storage Pool</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>{(totalStorageGB / 1024).toFixed(1)} TB</div>
            </div>
          </div>
        </div>

        {/* Test Connection Alert Result */}
        {testResult && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px 16px', 
            borderRadius: '10px', 
            background: testResult.success ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${testResult.success ? '#a7f3d0' : '#fecaca'}`,
            color: testResult.success ? '#065f46' : '#dc2626',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Detail Navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        borderBottom: '1px solid var(--border-subtle)', 
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'nodes', label: `Daftar Host Fisik (${nodes.length})`, icon: Server },
          { id: 'vms', label: `Virtual Machines (${vms.length})`, icon: Layers },
          { id: 'capacity', label: 'Alokasi & Kapasitas Resource', icon: Cpu },
          { id: 'settings', label: 'Konfigurasi Endpoint Hypervisor', icon: Key },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.86rem',
              fontWeight: activeTab === id ? 800 : 600,
              color: activeTab === id ? 'var(--ocean-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === id ? '2px solid var(--ocean-blue)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Member Hosts / Nodes Fisik */}
      {activeTab === 'nodes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Server Fisik (Host / Bare-Metal Nodes)
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                Daftar server fisik yang tergabung dalam cluster ini untuk menjalankan beban kerja VM.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsAddNodeOpen(true)}
              >
                <Plus size={14} />
                <span>+ Daftarkan Host Baru</span>
              </button>
            )}
          </div>

          {nodes.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <Server size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Belum Ada Host Fisik Terdaftar
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: '440px', margin: '0 auto 18px auto' }}>
                Cluster ini belum memiliki node compute aktif. Klik tombol <strong>Sync Cluster</strong> di atas untuk memindai otomatis dari hypervisor, atau daftarkan node secara manual.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsAddNodeOpen(true)}
                >
                  <Plus size={14} />
                  <span>Tambah Host Manual</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px' }}>
              {nodes.map((node) => {
                const nodeRamPct = node.ram_total_gb > 0 ? Math.round((node.ram_usage_gb / node.ram_total_gb) * 100) : 0;
                const nodeStoragePct = node.storage_total_gb > 0 ? Math.round((node.storage_usage_gb / node.storage_total_gb) * 100) : 0;
                const nodeVMCount = vms.filter(v => v.node_id === node.id || v.node_name === node.name).length;

                return (
                  <div key={node.id} className="glass-panel" style={{ padding: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '38px', 
                          height: '38px', 
                          borderRadius: '10px', 
                          background: '#eff6ff', 
                          color: '#1e3a8a', 
                          border: '1px solid #bfdbfe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Server size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{node.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            IP: {node.ip_address}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          background: '#ecfdf5', 
                          color: '#065f46', 
                          border: '1px solid #a7f3d0', 
                          padding: '2px 8px', 
                          borderRadius: '6px' 
                        }}>
                          {node.status || 'ONLINE'}
                        </span>

                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteNode(node)}
                            title="Hapus Host dari Cluster"
                            style={{ padding: '4px 6px', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div>CPU Model: <strong>{node.cpu_model || 'Intel Xeon / AMD EPYC'}</strong></div>
                      <div style={{ marginTop: '2px' }}>Kapasitas Fisik: <strong>{node.cpu_cores} Cores</strong> • Menjalankan <strong>{nodeVMCount} VM</strong></div>
                    </div>

                    {/* Progress Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* RAM */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Memori RAM:</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            {node.ram_usage_gb || 0} / {node.ram_total_gb} GB ({nodeRamPct}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(nodeRamPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)' }}></div>
                        </div>
                      </div>

                      {/* Storage */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Penyimpanan Lokal/Pool:</span>
                          <span style={{ fontWeight: 700, color: '#b45309' }}>
                            {node.storage_usage_gb || 0} / {node.storage_total_gb} GB ({nodeStoragePct}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(nodeStoragePct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #b45309, #f59e0b)' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Virtual Machines di Cluster ini */}
      {activeTab === 'vms' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Virtual Machines yang Berjalan di Cluster Ini
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                Total {vms.length} instance virtual machine dialokasikan pada host-host di cluster {cluster.name}.
              </p>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Virtual Machine</th>
                  <th>Host / Node Fisik</th>
                  <th>IP Address</th>
                  <th>Resource (vCPU / RAM / Disk)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {vms.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '36px' }}>
                      Belum ada virtual machine yang dideploy pada cluster ini.
                    </td>
                  </tr>
                ) : (
                  vms.map((vm) => {
                    const isRunning = vm.status === 'RUNNING';
                    return (
                      <tr key={vm.id}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{vm.name}</div>
                          <div style={{ fontSize: '0.74rem', color: '#1e3a8a' }}>{vm.os_type}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                            <Server size={14} color="#1e3a8a" />
                            <span>{vm.node_name || vm.node_id}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600 }}>
                            {vm.ip_address || 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem' }}>
                            <span style={{ fontWeight: 700, color: '#1e3a8a' }}>{vm.cpu_cores} vCPU</span> • 
                            <span style={{ fontWeight: 700, color: 'var(--text-main)', margin: '0 4px' }}>{Math.round(vm.ram_mb / 1024)}GB RAM</span> • 
                            <span style={{ fontWeight: 700, color: '#b45309' }}>{vm.disk_gb}GB</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`}></span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isRunning ? '#059669' : 'var(--text-dim)' }}>
                              {vm.status}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigateVM && onNavigateVM(vm.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                          >
                            <span>Detail VM</span>
                            <ExternalLink size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Alokasi & Kapasitas Resource */}
      {activeTab === 'capacity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px' }}>
              Kapasitas Agregat Seluruh Host Fisik
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
              {/* CPU Cores */}
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)' }}>Alokasi vCPU Cores</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e3a8a' }}>
                    {usedCores} / {totalCores} Cores ({cpuPct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(cpuPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)' }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                  Tersedia: {Math.max(totalCores - usedCores, 0)} Cores fisik untuk alokasi baru
                </div>
              </div>

              {/* Memory RAM */}
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)' }}>Alokasi Memori RAM</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>
                    {usedRAMGB} / {totalRAM} GB ({ramPct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(ramPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #059669, #10b981)' }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                  Tersedia: {Math.max(totalRAM - usedRAMGB, 0)} GB RAM untuk alokasi baru
                </div>
              </div>

              {/* Storage Pool */}
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)' }}>Alokasi Storage Disk</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b45309' }}>
                    {usedStorageGB} / {totalStorageGB} GB ({storagePct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(storagePct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #b45309, #f59e0b)' }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                  Tersedia: {Math.max(Math.round((totalStorageGB - usedStorageGB) / 1024), 0)} TB untuk alokasi virtual disk
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Konfigurasi Endpoint Hypervisor */}
      {activeTab === 'settings' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={20} style={{ color: 'var(--ocean-blue)' }} />
            <span>Kredensial & Pengaturan API Hypervisor</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>API Endpoint URL</div>
              <div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                {cluster.endpoint}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Port {isVMware ? '443 (HTTPS REST)' : '8006 (Proxmox PVE API)'}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Username / Token ID</div>
              <div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e3a8a', marginTop: '4px' }}>
                {cluster.auth_user || 'root@pam!iaas-token'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Hak Akses: PVEAuditor / SysAdmin
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Verifikasi SSL Certificate</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: cluster.insecure_ssl ? '#b45309' : '#059669', marginTop: '4px' }}>
                {cluster.insecure_ssl ? 'Insecure (Self-Signed Allowed)' : 'Strict TLS Verified'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Aman untuk lingkungan datacenter lokal / intranet
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Host Fisik Baru */}
      {isAddNodeOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Daftarkan Host Fisik Baru</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Tambahkan server fisik ke dalam cluster {cluster.name}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsAddNodeOpen(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateNode}>
              <div className="modal-body">
                {nodeError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{nodeError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Hostname / FQDN Host</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. pve-srv-02.pal.local" 
                      value={nodeName} 
                      onChange={(e) => setNodeName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Node ID (e.g. nodename)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. pve-srv-02" 
                      value={nodeId} 
                      onChange={(e) => setNodeId(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Alamat IP Management</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. 192.168.1.102" 
                      value={nodeIP} 
                      onChange={(e) => setNodeIP(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Model Processor (CPU)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Intel Xeon Gold 6248R" 
                      value={cpuModel} 
                      onChange={(e) => setCpuModel(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Cores CPU</label>
                    <input 
                      type="number" 
                      min="1"
                      className="form-input" 
                      value={cpuCores} 
                      onChange={(e) => setCpuCores(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">RAM (GB)</label>
                    <input 
                      type="number" 
                      min="1"
                      className="form-input" 
                      value={ramGB} 
                      onChange={(e) => setRamGB(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Storage (GB)</label>
                    <input 
                      type="number" 
                      min="10"
                      className="form-input" 
                      value={storageGB} 
                      onChange={(e) => setStorageGB(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddNodeOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingNode}>
                  {isSubmittingNode ? 'Menambahkan...' : 'Daftarkan Host ke Cluster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
