import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import DashboardOverview from './components/DashboardOverview';
import ClusterTopology from './components/ClusterTopology';
import VMManagement from './components/VMManagement';
import CreateVMModal from './components/CreateVMModal';
import EditVMModal from './components/EditVMModal';
import VMConsoleModal from './components/VMConsoleModal';
import BillingRatesConfig from './components/BillingRatesConfig';
import UserManagement from './components/UserManagement';
import BillingPreview from './components/BillingPreview';
import LoginModal from './components/LoginModal';
import RebuildVMModal from './components/RebuildVMModal';
import VMResourceModal from './components/VMResourceModal';
import { api } from './api/client';

export default function App() {
  const [user, setUser] = useState(api.getUser());
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data state
  const [summary, setSummary] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [vms, setVMs] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [fleetTelemetry, setFleetTelemetry] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVM, setEditingVM] = useState(null);
  const [consoleVM, setConsoleVM] = useState(null);
  const [rebuildVM, setRebuildVM] = useState(null);
  const [resourceVM, setResourceVM] = useState(null);

  // Notification Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch all initial data
  const loadData = useCallback(async () => {
    if (!api.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const [sumData, clusterData, vmData] = await Promise.all([
        api.getDashboardSummary(),
        api.getClusters(),
        api.getVMs(),
      ]);

      setSummary(sumData);
      setClusters(clusterData || []);
      
      const seenVMs = new Set();
      const uniqueVMs = (vmData || []).filter((vm) => {
        const key = vm.id || `${vm.cluster_id}-${vm.vmid || vm.name}`;
        if (seenVMs.has(key)) return false;
        seenVMs.add(key);
        return true;
      });
      setVMs(uniqueVMs);

      if (api.isAdmin()) {
        const [tenantData, userData] = await Promise.all([
          api.getTenants(),
          api.getUsers(),
        ]);
        setTenants(tenantData || []);
        setUsers(userData || []);
      }

      // Fetch live telemetry for VMs
      try {
        const telemList = await api.getFleetTelemetry();
        if (Array.isArray(telemList)) {
          const telemMap = {};
          telemList.forEach((t) => {
            if (t.vm_id) telemMap[t.vm_id] = t;
          });
          setFleetTelemetry(telemMap);
        }
      } catch (telErr) {
        console.warn("Fleet telemetry background fetch error:", telErr);
      }
    } catch (err) {
      console.error("Failed to load cloud state:", err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (api.isAuthenticated()) {
      loadData();
    } else {
      setLoading(false);
    }

    // Auto-refresh metrics every 15 seconds
    const interval = setInterval(() => {
      if (api.isAuthenticated()) {
        loadData();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Auth Handlers
  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    loadData();
    showToast(`Welcome, ${loggedInUser.full_name || loggedInUser.username} (${loggedInUser.role})`);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setActiveTab('overview');
    showToast("Logged out successfully");
  };

  const handleSwitchRole = async () => {
    const targetRole = user?.role === 'ADMIN' ? 'operator' : 'admin';
    const targetPass = targetRole === 'admin' ? 'admin123' : 'operator123';
    try {
      const resp = await api.login(targetRole, targetPass);
      setUser(resp.user);
      await loadData();
      showToast(`Switched active session to: ${resp.user.role}`);
    } catch (err) {
      showToast("Failed to switch role: " + err.message, 'error');
    }
  };

  // VM Action Handlers
  const handleStartVM = async (vm) => {
    try {
      await api.executeVMAction(vm.id, 'start');
      showToast(`Virtual machine '${vm.name}' powered ON`);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleStopVM = async (vm) => {
    try {
      await api.executeVMAction(vm.id, 'stop');
      showToast(`Virtual machine '${vm.name}' powered OFF`);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRestartVM = async (vm) => {
    try {
      await api.executeVMAction(vm.id, 'restart');
      showToast(`Reboot signal sent to '${vm.name}'`);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteVM = async (vm) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${vm.name}'? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteVM(vm.id);
      showToast(`Virtual machine '${vm.name}' deleted successfully`);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateVM = async (payload) => {
    const newVM = await api.createVM(payload);
    showToast(`Virtual machine '${newVM.name}' deployed on ${newVM.hypervisor_type}`);
    await loadData();
  };

  const handleUpdateVM = async (id, payload) => {
    await api.updateVM(id, payload);
    showToast(`Updated virtual machine specifications`);
    await loadData();
  };

  // Dedicated Login Page if unauthenticated
  if (!user) {
    return (
      <>
        {toast && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 1000,
            background: toast.type === 'error' 
              ? '#b91c1c' 
              : '#0f172a',
            border: toast.type === 'error' ? '1px solid #991b1b' : '1px solid #1e3a8a',
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.25)',
            fontSize: '0.88rem',
            fontWeight: 700,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {toast.message}
          </div>
        )}
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 1000,
          background: toast.type === 'error' 
            ? '#b91c1c' 
            : '#0f172a',
          border: toast.type === 'error' ? '1px solid #991b1b' : '1px solid #1e3a8a',
          color: '#ffffff',
          padding: '12px 22px',
          borderRadius: '10px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.25)',
          fontSize: '0.88rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user}
        onSwitchRole={handleSwitchRole}
        onLogout={handleLogout}
      />

      {/* Main Page Content */}
      <main className="main-content">
        {activeTab === 'overview' && (
          <DashboardOverview 
            summary={summary} 
            vms={vms}
            fleetTelemetry={fleetTelemetry}
            user={user}
            onStartVM={handleStartVM}
            onStopVM={handleStopVM}
            onRestartVM={handleRestartVM}
            onOpenResourceModal={(vm) => setResourceVM(vm)}
            onOpenRebuildModal={(vm) => setRebuildVM(vm)}
            onNavigateTab={setActiveTab} 
          />
        )}

        {activeTab === 'clusters' && (
          <ClusterTopology 
            clusters={clusters} 
            onRefresh={loadData} 
            showToast={showToast}
          />
        )}

        {activeTab === 'vms' && (
          <VMManagement 
            vms={vms}
            user={user}
            clusters={clusters}
            fleetTelemetry={fleetTelemetry}
            onStartVM={handleStartVM}
            onStopVM={handleStopVM}
            onRestartVM={handleRestartVM}
            onOpenConsole={(vm) => setConsoleVM(vm)}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onOpenEditModal={(vm) => setEditingVM(vm)}
            onOpenRebuildModal={(vm) => setRebuildVM(vm)}
            onOpenResourceModal={(vm) => setResourceVM(vm)}
            onDeleteVM={handleDeleteVM}
          />
        )}

        {activeTab === 'users' && user?.role === 'ADMIN' && (
          <UserManagement 
            users={users}
            vms={vms}
            tenants={tenants}
            onRefresh={loadData}
            showToast={showToast}
          />
        )}

        {activeTab === 'billing-rates' && user?.role === 'ADMIN' && (
          <BillingRatesConfig 
            onRatesUpdated={() => showToast('Tarif billing berhasil disimpan dan disinkronkan')}
            onNavigateBilling={() => setActiveTab('billing')}
          />
        )}

        {activeTab === 'billing' && (
          <BillingPreview 
            user={user}
            onNavigateRates={() => setActiveTab('billing-rates')}
          />
        )}
      </main>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateVMModal 
          clusters={clusters}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateVM}
        />
      )}

      {editingVM && (
        <EditVMModal 
          vm={editingVM}
          onClose={() => setEditingVM(null)}
          onUpdate={handleUpdateVM}
        />
      )}

      {consoleVM && (
        <VMConsoleModal 
          vm={consoleVM}
          onClose={() => setConsoleVM(null)}
        />
      )}

      {rebuildVM && (
        <RebuildVMModal 
          vm={rebuildVM}
          clusters={clusters}
          onClose={() => setRebuildVM(null)}
          onRebuildSuccess={(msg) => {
            showToast(msg || `Instalasi ulang OS untuk '${rebuildVM.name}' berhasil diinisialisasi`);
            setRebuildVM(null);
            loadData();
          }}
        />
      )}

      {resourceVM && (
        <VMResourceModal 
          vm={resourceVM}
          onClose={() => setResourceVM(null)}
        />
      )}
    </div>
  );
}
