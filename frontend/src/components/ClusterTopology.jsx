import React, { useState } from 'react';
import { 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  Clock, 
  Layers, 
  RefreshCw,
  Plus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Key,
  Wifi,
  ExternalLink
} from 'lucide-react';
import { api } from '../api/client';

export default function ClusterTopology({ clusters = [], onRefresh, onNavigateCluster, showToast }) {
  const [selectedClusterFilter, setSelectedClusterFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [isAddClusterOpen, setIsAddClusterOpen] = useState(false);
  const [activeClusterForNode, setActiveClusterForNode] = useState(null);

  // New Cluster Form State
  const [clusterId, setClusterId] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [clusterType, setClusterType] = useState('PROXMOX');
  const [datacenter, setDatacenter] = useState('DC-LOCAL-01');
  const [endpoint, setEndpoint] = useState('https://192.168.1.100:8006');
  const [authUser, setAuthUser] = useState('root@pam!iaas-token');
  const [authSecret, setAuthSecret] = useState('');
  const [insecureSSL, setInsecureSSL] = useState(true);
  const [autoDiscover, setAutoDiscover] = useState(true);
  const [description, setDescription] = useState('');
  const [isSubmittingCluster, setIsSubmittingCluster] = useState(false);
  const [clusterError, setClusterError] = useState('');

  // Live Connection Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Cluster Syncing State
  const [syncingClusterId, setSyncingClusterId] = useState(null);

  // New Node Form State
  const [nodeId, setNodeId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeIP, setNodeIP] = useState('');
  const [cpuModel, setCpuModel] = useState('Intel Xeon Gold / AMD EPYC');
  const [cpuCores, setCpuCores] = useState(32);
  const [ramGB, setRamGB] = useState(256);
  const [storageGB, setStorageGB] = useState(4000);
  const [isSubmittingNode, setIsSubmittingNode] = useState(false);
  const [nodeError, setNodeError] = useState('');

  const isAdmin = api.isAdmin();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const notify = (msg, type = 'success') => {
    if (showToast) showToast(msg, type);
    else alert(msg);
  };

  const handleTypeChange = (newType) => {
    setClusterType(newType);
    setTestResult(null);
    setClusterError('');
    if (newType === 'PROXMOX') {
      if (!endpoint || endpoint.includes('vcenter')) setEndpoint('https://192.168.1.100:8006');
      if (!authUser || authUser.includes('vsphere.local')) setAuthUser('root@pam!iaas-token');
    } else {
      if (!endpoint || endpoint.includes('8006')) setEndpoint('https://vcenter.local');
      if (!authUser || authUser.includes('pam')) setAuthUser('administrator@vsphere.local');
    }
  };

  // Test Connection Handler
  const handleTestConnection = async () => {
    setClusterError('');
    setTestResult(null);

    if (!endpoint.trim()) {
      setClusterError('API Endpoint URL is required for testing connection');
      return;
    }

    setIsTesting(true);
    try {
      const res = await api.testClusterConnection({
        type: clusterType,
        endpoint: endpoint.trim(),
        auth_user: authUser.trim(),
        auth_secret: authSecret.trim(),
        insecure_ssl: insecureSSL,
        datacenter: datacenter.trim() || 'DC-MAIN',
      });
      setTestResult(res);
      if (res.success) {
        notify(`Connection successful: ${res.version || clusterType} (${res.node_count || 0} nodes detected)`);
      } else {
        notify(`Connection failed: ${res.message}`, 'error');
      }
    } catch (err) {
      const errMsg = err.message || 'Connection failed: Check network reachability and credentials';
      setTestResult({
        success: false,
        message: errMsg,
      });
      notify('Connection test failed: ' + errMsg, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  // Synchronize Cluster Handler
  const handleSyncCluster = async (cluster) => {
    setSyncingClusterId(cluster.id);
    try {
      const updated = await api.syncCluster(cluster.id);
      const nodeCount = updated?.nodes?.length || 0;
      notify(`Cluster '${cluster.name}' synchronized successfully! Discovered ${nodeCount} node(s).`);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notify(`Failed to synchronize cluster: ${err.message}`, 'error');
    } finally {
      setSyncingClusterId(null);
    }
  };

  // Create Cluster Handler
  const handleCreateCluster = async (e) => {
    e.preventDefault();
    setClusterError('');

    if (!clusterName.trim() || !endpoint.trim()) {
      setClusterError('Cluster Name and Endpoint are required');
      return;
    }

    const finalId = clusterId.trim() || clusterName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    setIsSubmittingCluster(true);
    try {
      const created = await api.createCluster({
        id: finalId,
        name: clusterName.trim(),
        type: clusterType,
        datacenter: datacenter.trim() || 'DC-MAIN',
        endpoint: endpoint.trim(),
        auth_user: authUser.trim(),
        auth_secret: authSecret.trim(),
        insecure_ssl: insecureSSL,
        version: testResult?.version || '',
        auto_discover: autoDiscover,
        description: description.trim(),
      });
      const nodeCount = created?.nodes?.length || 0;
      notify(`Cluster '${clusterName}' connected successfully! ${autoDiscover ? `Auto-discovery imported ${nodeCount} node(s).` : ''}`);
      setIsAddClusterOpen(false);
      setClusterId('');
      setClusterName('');
      setAuthSecret('');
      setTestResult(null);
      setDescription('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setClusterError(err.message || 'Failed to register cluster');
    } finally {
      setIsSubmittingCluster(false);
    }
  };

  // Delete Cluster Handler
  const handleDeleteCluster = async (cluster) => {
    if (!window.confirm(`Permanently remove cluster '${cluster.name}' and all its registered nodes?`)) {
      return;
    }
    try {
      await api.deleteCluster(cluster.id);
      notify(`Cluster '${cluster.name}' deleted`);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notify('Failed to delete cluster: ' + err.message, 'error');
    }
  };

  // Add Node Handler
  const handleAddNode = async (e) => {
    e.preventDefault();
    setNodeError('');

    if (!nodeName.trim() || !nodeIP.trim()) {
      setNodeError('Node Name and IP Address are required');
      return;
    }

    const finalId = nodeId.trim() || nodeName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    setIsSubmittingNode(true);
    try {
      await api.addNode(activeClusterForNode.id, {
        id: finalId,
        name: nodeName.trim(),
        ip_address: nodeIP.trim(),
        cpu_model: cpuModel.trim(),
        cpu_cores: parseInt(cpuCores, 10),
        ram_total_gb: parseInt(ramGB, 10),
        storage_total_gb: parseInt(storageGB, 10),
      });
      notify(`Compute node '${nodeName}' added to cluster '${activeClusterForNode.name}'`);
      setActiveClusterForNode(null);
      setNodeId('');
      setNodeName('');
      setNodeIP('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setNodeError(err.message || 'Failed to add node');
    } finally {
      setIsSubmittingNode(false);
    }
  };

  // Delete Node Handler
  const handleDeleteNode = async (clusterId, node) => {
    if (!window.confirm(`Remove compute node '${node.name}' (${node.ip_address})?`)) {
      return;
    }
    try {
      await api.deleteNode(clusterId, node.id);
      notify(`Node '${node.name}' removed`);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notify('Failed to remove node: ' + err.message, 'error');
    }
  };

  // Reset to Virgin Database Handler
  const handleResetVirgin = async () => {
    const confirmation = window.prompt("WARNING: This will wipe ALL clusters, nodes, VMs, and activity logs to a 100% virgin state. Type 'VIRGIN' to confirm:");
    if (confirmation !== 'VIRGIN') {
      return;
    }
    try {
      await api.resetVirgin();
      notify('Environment completely reset to Virgin state!');
      if (onRefresh) await onRefresh();
    } catch (err) {
      notify('Failed to reset: ' + err.message, 'error');
    }
  };

  const filteredClusters = selectedClusterFilter === 'ALL' 
    ? clusters 
    : clusters.filter(c => c.id === selectedClusterFilter);

  const totalNodesCount = clusters.reduce((acc, c) => acc + (c.nodes?.length || 0), 0);
  const vmwareCount = clusters.filter(c => c.type === 'VMWARE').length;
  const proxmoxCount = clusters.filter(c => c.type === 'PROXMOX').length;

  const formatUptime = (seconds) => {
    if (!seconds || seconds <= 0) return '0h';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  return (
    <div>
      {/* Header and Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Clusters & Compute Nodes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            Controlling {clusters.length} Cluster{clusters.length !== 1 ? 's' : ''} • {totalNodesCount} Bare-Metal Compute Node{totalNodesCount !== 1 ? 's' : ''} ({vmwareCount} VMware + {proxmoxCount} Proxmox)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Cluster Filter Buttons */}
          {clusters.length > 0 && (
            <div style={{ display: 'flex', background: 'rgba(240, 244, 248, 0.9)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)', gap: '4px' }}>
              <button
                className={`btn btn-sm ${selectedClusterFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedClusterFilter('ALL')}
              >
                All ({clusters.length})
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
          )}

          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            title="Refresh Node Telemetry"
            style={{ padding: '7px 14px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Poll Telemetry</span>
          </button>

          {isAdmin && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setIsAddClusterOpen(true)}
                style={{ padding: '7px 14px' }}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Connect Cluster</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleResetVirgin}
                title="Wipe database back to 100% clean/virgin state"
                style={{ padding: '7px 12px', color: '#b91c1c' }}
              >
                <RotateCcw size={13} />
                <span>Reset to Virgin</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty State: Virgin Environment */}
      {clusters.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 30px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: '#eff6ff',
            color: '#1e3a8a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto',
            border: '1px solid #bfdbfe'
          }}>
            <Layers size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            No Hypervisor Clusters Registered (Virgin Environment)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '560px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
            The database is currently clean and virgin with 0 mock clusters and 0 virtual machines. Register your Proxmox VE or VMware vSphere endpoint below to start orchestrating real hardware nodes.
          </p>
          {isAdmin && (
            <button 
              className="btn btn-primary"
              onClick={() => setIsAddClusterOpen(true)}
              style={{ padding: '10px 22px' }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Connect First Hypervisor Cluster</span>
            </button>
          )}
        </div>
      ) : (
        /* Cluster Sections */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {filteredClusters.map((cluster) => {
            const isVMware = cluster.type === 'VMWARE';
            const nodes = cluster.nodes || [];

            return (
              <div key={cluster.id} className="glass-panel" style={{ padding: '26px' }}>
                {/* Cluster Title Banner */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', paddingBottom: '18px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '14px' }}>
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
                        <h2 
                          onClick={() => onNavigateCluster && onNavigateCluster(cluster.id)}
                          style={{ 
                            fontSize: '1.3rem', 
                            fontWeight: 800, 
                            cursor: onNavigateCluster ? 'pointer' : 'default',
                            textDecoration: onNavigateCluster ? 'underline dotted' : 'none'
                          }}
                          title="Buka Halaman Detail Cluster & Host"
                        >
                          {cluster.name}
                        </h2>
                        <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'}>{cluster.type}</span>
                        {cluster.version && (
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                            {cluster.version}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>Endpoint: <code style={{ color: '#1e3a8a', fontFamily: 'var(--font-mono)' }}>{cluster.endpoint}</code></span>
                        <span>• Datacenter: <strong style={{ color: 'var(--text-main)' }}>{cluster.datacenter}</strong></span>
                        {cluster.auth_user && (
                          <span>• Auth: <code style={{ fontSize: '0.74rem', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#334155' }}>{cluster.auth_user}</code></span>
                        )}
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 600, 
                          padding: '1px 6px', 
                          borderRadius: '4px', 
                          background: cluster.insecure_ssl ? '#fef3c7' : '#f0fdf4', 
                          color: cluster.insecure_ssl ? '#b45309' : '#15803d',
                          border: `1px solid ${cluster.insecure_ssl ? '#fde68a' : '#bbf7d0'}`
                        }}>
                          {cluster.insecure_ssl ? 'SSL: Insecure (Self-Signed)' : 'SSL: Verified'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>STATUS CLUSTER</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{nodes.length} Physical Node{nodes.length !== 1 ? 's' : ''}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: nodes.length > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)', padding: '6px 14px', borderRadius: '9999px', border: nodes.length > 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(100, 116, 139, 0.25)' }}>
                      <span className={`status-dot ${nodes.length > 0 ? 'online' : 'stopped'}`}></span>
                      <span style={{ fontSize: '0.78rem', color: nodes.length > 0 ? '#059669' : 'var(--text-muted)', fontWeight: 700 }}>
                        {nodes.length > 0 ? 'Cluster Ready' : 'Awaiting Nodes'}
                      </span>
                    </div>

                    {isAdmin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigateCluster && onNavigateCluster(cluster.id)}
                          title="Buka Halaman Detail Cluster & Host"
                          style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          <ExternalLink size={13} />
                          <span>Detail Cluster</span>
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSyncCluster(cluster)}
                          disabled={syncingClusterId === cluster.id}
                          title="Query Hypervisor API and auto-discover bare-metal nodes & existing VMs"
                          style={{ padding: '6px 12px' }}
                        >
                          <RefreshCw size={13} className={syncingClusterId === cluster.id ? 'spin' : ''} />
                          <span>{syncingClusterId === cluster.id ? 'Syncing...' : 'Sync Cluster'}</span>
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveClusterForNode(cluster);
                            setNodeName(`${cluster.id}-node-${(cluster.nodes?.length || 0) + 1}`);
                            setNodeIP('192.168.1.' + (100 + (cluster.nodes?.length || 0) + 1));
                          }}
                          title="Add Bare-Metal Node Manually"
                          style={{ padding: '6px 12px' }}
                        >
                          <Plus size={13} />
                          <span>Add Node</span>
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteCluster(cluster)}
                          title="Delete Cluster"
                          style={{ padding: '6px 9px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nodes Grid */}
                {nodes.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-subtle)' }}>
                    <Server size={30} color="var(--text-dim)" style={{ margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>No Physical Nodes Registered</div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '520px', margin: '4px auto 16px auto', lineHeight: 1.5 }}>
                      Click <strong>Sync Cluster</strong> to query the hypervisor endpoint (<code style={{ fontSize: '0.78rem' }}>{cluster.endpoint}</code>) and automatically discover all compute hosts and VMs, or add bare-metal nodes manually.
                    </p>
                    {isAdmin && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSyncCluster(cluster)}
                          disabled={syncingClusterId === cluster.id}
                          style={{ padding: '7px 16px' }}
                        >
                          <RefreshCw size={13} className={syncingClusterId === cluster.id ? 'spin' : ''} />
                          <span>{syncingClusterId === cluster.id ? 'Discovering...' : 'Sync Cluster'}</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveClusterForNode(cluster);
                            setNodeName(`${cluster.id}-node-01`);
                            setNodeIP('192.168.1.101');
                          }}
                          style={{ padding: '7px 14px' }}
                        >
                          <Plus size={13} />
                          <span>Add Manually</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
                    {nodes.map((node) => {
                      const ramPct = node.ram_total_gb > 0 ? Math.round((node.ram_usage_gb / node.ram_total_gb) * 100) : 0;
                      const storagePct = node.storage_total_gb > 0 ? Math.round((node.storage_usage_gb / node.storage_total_gb) * 100) : 0;
                      const isReady = node.status === 'READY';

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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span className={`status-dot ${isReady ? 'ready' : 'stopped'}`}></span>
                                <span style={{ fontSize: '0.78rem', color: isReady ? '#059669' : '#dc2626', fontWeight: 700 }}>
                                  {node.status}
                                </span>
                              </div>
                              {isAdmin && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleDeleteNode(cluster.id, node)}
                                  title="Remove Node"
                                  style={{ padding: '4px 6px', color: '#b91c1c' }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Connect / Register Cluster */}
      {isAddClusterOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>Connect Hypervisor Cluster</h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Establish real-time API connection to Proxmox VE or VMware vSphere cluster
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsAddClusterOpen(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCluster}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {clusterError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 14px', borderRadius: '10px', color: '#dc2626', fontSize: '0.86rem', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>Connection / Registration Error</div>
                      <div style={{ marginTop: '2px', opacity: 0.9 }}>{clusterError}</div>
                    </div>
                  </div>
                )}

                {/* Hypervisor Platform Selector Cards */}
                <div>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Hypervisor Platform</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
                    <div 
                      onClick={() => handleTypeChange('PROXMOX')}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        border: clusterType === 'PROXMOX' ? '2px solid #ea580c' : '1px solid var(--border-subtle)',
                        background: clusterType === 'PROXMOX' ? 'rgba(234, 88, 12, 0.06)' : '#f8fafc',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: clusterType === 'PROXMOX' ? '#c2410c' : 'var(--text-main)' }}>
                          Proxmox VE
                        </span>
                        <span className="badge-proxmox" style={{ fontSize: '0.7rem' }}>PVE 7 / 8</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                        Connect via REST API (Port 8006) using User Token ID or credentials
                      </p>
                    </div>

                    <div 
                      onClick={() => handleTypeChange('VMWARE')}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        border: clusterType === 'VMWARE' ? '2px solid #1e3a8a' : '1px solid var(--border-subtle)',
                        background: clusterType === 'VMWARE' ? 'rgba(30, 58, 138, 0.06)' : '#f8fafc',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: clusterType === 'VMWARE' ? '#1e3a8a' : 'var(--text-main)' }}>
                          VMware vSphere
                        </span>
                        <span className="badge-vmware" style={{ fontSize: '0.7rem' }}>vCenter 7 / 8</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                        Connect via vCenter REST Session API using vsphere.local credentials
                      </p>
                    </div>
                  </div>
                </div>

                {/* Basic Cluster Metadata */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Cluster Display Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={clusterType === 'PROXMOX' ? 'e.g. Proxmox Cluster 01' : 'e.g. VMware Production Cluster'} 
                      value={clusterName} 
                      onChange={(e) => setClusterName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cluster ID / Slug (Optional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={clusterType === 'PROXMOX' ? 'e.g. pve-cluster-01' : 'e.g. vc-prod-01'} 
                      value={clusterId} 
                      onChange={(e) => setClusterId(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Datacenter Identifier</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. DC-MAIN" 
                      value={datacenter} 
                      onChange={(e) => setDatacenter(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">API Endpoint URL</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={clusterType === 'PROXMOX' ? 'https://192.168.1.100:8006' : 'https://vcenter.local'} 
                      value={endpoint} 
                      onChange={(e) => setEndpoint(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Hypervisor Authentication Credentials */}
                <div style={{ 
                  background: 'rgba(241, 245, 249, 0.7)', 
                  border: '1px solid var(--border-subtle)', 
                  padding: '16px', 
                  borderRadius: '12px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Key size={16} color="#1e3a8a" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {clusterType === 'PROXMOX' ? 'Proxmox API Token Credentials' : 'vCenter Server Credentials'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">
                        {clusterType === 'PROXMOX' ? 'API Token ID (or Username)' : 'vCenter Username'}
                      </label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder={clusterType === 'PROXMOX' ? 'root@pam!iaas-token' : 'administrator@vsphere.local'} 
                        value={authUser} 
                        onChange={(e) => setAuthUser(e.target.value)}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '3px', display: 'block' }}>
                        {clusterType === 'PROXMOX' ? 'Format: USER@REALM!TOKENID or root@pam' : 'Domain account with vCenter access'}
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        {clusterType === 'PROXMOX' ? 'API Token Secret (UUID) / Password' : 'Password'}
                      </label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder={clusterType === 'PROXMOX' ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : '••••••••••••'} 
                        value={authSecret} 
                        onChange={(e) => setAuthSecret(e.target.value)}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '3px', display: 'block' }}>
                        {clusterType === 'PROXMOX' ? 'Token UUID secret generated in PVE Datacenter' : 'Password for the vCenter user'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security and Auto-Discovery Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={insecureSSL} 
                      onChange={(e) => setInsecureSSL(e.target.checked)}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={14} color="#b45309" />
                        Skip TLS / SSL Certificate Verification (Recommended)
                      </span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                        Allows connecting to hypervisors with self-signed SSL certificates without TLS handshake rejection.
                      </span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={autoDiscover} 
                      onChange={(e) => setAutoDiscover(e.target.checked)}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={14} color="#059669" />
                        Auto-Discover Compute Nodes & Existing VMs on Connect
                      </span>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                        Memindai hypervisor langsung untuk memperbarui node fisik, kapasitas CPU/RAM, dan status VM ke sistem.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Live Connectivity Test Result Panel */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>Live Connectivity Test</span>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                      <Wifi size={13} className={isTesting ? 'spin' : ''} />
                      <span>{isTesting ? 'Testing Link...' : 'Test Connection'}</span>
                    </button>
                  </div>

                  {isTesting && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 14px', borderRadius: '10px', color: '#15803d', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={16} className="spin" />
                      <span>Connecting to {clusterType} API endpoint at <strong>{endpoint}</strong>...</span>
                    </div>
                  )}

                  {testResult && !isTesting && (
                    <div style={{ 
                      background: testResult.success ? '#f0fdf4' : '#fef2f2', 
                      border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`, 
                      padding: '14px', 
                      borderRadius: '10px' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: testResult.success ? '#15803d' : '#dc2626', fontWeight: 800, fontSize: '0.9rem' }}>
                        {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span>{testResult.success ? 'Hypervisor Connection Verified!' : 'Connection Attempt Failed'}</span>
                      </div>
                      
                      <div style={{ fontSize: '0.82rem', color: testResult.success ? '#166534' : '#991b1b', marginTop: '6px', lineHeight: 1.5 }}>
                        {testResult.message}
                      </div>

                      {testResult.success && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(22, 101, 52, 0.15)', display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: '#166534' }}>
                          <span>Detected: <strong>{testResult.version || clusterType}</strong></span>
                          <span>• Compute Nodes: <strong>{testResult.node_count || 0}</strong></span>
                          <span>• VMs Found: <strong>{testResult.vm_count || 0}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea 
                    className="form-input" 
                    rows={2}
                    placeholder="e.g. Primary on-premise compute cluster for production VMs" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddClusterOpen(false)}>
                  Cancel
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    <Wifi size={14} className={isTesting ? 'spin' : ''} />
                    <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={isSubmittingCluster || isTesting}
                  >
                    {isSubmittingCluster ? 'Connecting & Syncing...' : 'Connect & Register Cluster'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Compute Node */}
      {activeClusterForNode && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Add Compute Node</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Register physical host to cluster: <strong style={{ color: '#1e3a8a' }}>{activeClusterForNode.name}</strong>
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveClusterForNode(null)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddNode}>
              <div className="modal-body">
                {nodeError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{nodeError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Node Hostname / FQDN</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. pve-srv-01.cloud.local" 
                      value={nodeName} 
                      onChange={(e) => setNodeName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Node ID (e.g. Proxmox nodename)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. pve-srv-01" 
                      value={nodeId} 
                      onChange={(e) => setNodeId(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Management IP Address</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. 192.168.1.101" 
                      value={nodeIP} 
                      onChange={(e) => setNodeIP(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">CPU Model</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Intel Xeon Silver 4210 / AMD EPYC" 
                      value={cpuModel} 
                      onChange={(e) => setCpuModel(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">CPU Cores</label>
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
                <button type="button" className="btn btn-secondary" onClick={() => setActiveClusterForNode(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingNode}>
                  {isSubmittingNode ? 'Adding Node...' : 'Add Compute Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
