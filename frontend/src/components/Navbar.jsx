import React from 'react';
import { 
  Cloud, 
  LayoutDashboard, 
  Server, 
  HardDrive, 
  Building2, 
  Receipt, 
  User, 
  Users,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onSwitchRole, onLogout }) {
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="nav-brand">
          <div className="brand-icon">
            <Cloud size={22} color="#f0e8d0" strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">CloudForge IaaS</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
              VMWARE & PROXMOX CONTROLLER
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button 
            className={`nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={16} />
            <span>Overview</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'clusters' ? 'active' : ''}`}
            onClick={() => setActiveTab('clusters')}
          >
            <Server size={16} />
            <span>Clusters (4) & Nodes (12)</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'vms' ? 'active' : ''}`}
            onClick={() => setActiveTab('vms')}
          >
            <HardDrive size={16} />
            <span>Virtual Machines</span>
          </button>

          {isAdmin && (
            <>
              <button 
                className={`nav-tab-btn ${activeTab === 'tenants' ? 'active' : ''}`}
                onClick={() => setActiveTab('tenants')}
              >
                <Building2 size={16} />
                <span>Tenants & Quotas</span>
              </button>

              <button 
                className={`nav-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Users size={16} />
                <span>Users & VM Access</span>
              </button>
            </>
          )}

          <button 
            className={`nav-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <Receipt size={16} />
            <span>Billing Telemetry</span>
          </button>
        </nav>

        {/* User Status & Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="user-badge">
            {isAdmin ? <ShieldCheck size={18} color="var(--accent-cyan)" /> : <UserCheck size={18} color="var(--accent-emerald)" />}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`role-pill ${isAdmin ? 'admin' : 'operator'}`}>
                  {user?.role}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  {isAdmin ? 'Full Access' : 'Read/Power/Console'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Demo Switch Role Button */}
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onSwitchRole}
            title={isAdmin ? "Switch to VM Operator role for testing" : "Switch to Admin role"}
            style={{ fontSize: '0.78rem', padding: '6px 10px' }}
          >
            <RefreshCw size={13} />
            <span>Switch to {isAdmin ? 'Operator' : 'Admin'}</span>
          </button>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={onLogout}
            title="Log Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
