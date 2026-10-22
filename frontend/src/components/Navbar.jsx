import React from 'react';
import { 
  Compass, 
  LayoutDashboard, 
  Server, 
  HardDrive, 
  Building2, 
  Receipt, 
  Users, 
  LogOut, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onSwitchRole, onLogout }) {
  const isAdmin = user?.role === 'ADMIN';

  // Short labels keep the bar on a single line; full description lives in the tooltip
  const tabs = [
    { id: 'overview', label: 'Overview', title: 'Overview', icon: LayoutDashboard },
    { id: 'clusters', label: 'Clusters', title: 'Clusters (4) & Nodes (12)', icon: Server },
    { id: 'vms', label: 'VM Fleet', title: 'Virtual Machines', icon: HardDrive },
    ...(isAdmin ? [
      { id: 'tenants', label: 'Tenants', title: 'Tenants & Quotas', icon: Building2 },
      { id: 'users', label: 'Users', title: 'Users & VM Access', icon: Users },
    ] : []),
    { id: 'billing', label: 'Billing', title: 'Billing Telemetry', icon: Receipt },
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand with Maritime Compass Crest */}
        <div className="nav-brand">
          <div className="brand-icon">
            <Compass size={22} color="#ffffff" strokeWidth={2.4} />
          </div>
          <div className="brand-text">
            <div className="brand-title">CloudForge IaaS</div>
            <div className="brand-subtitle">Maritime Hybrid Cloud</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          {tabs.map(({ id, label, title, icon: Icon }) => (
            <button
              key={id}
              className={`nav-tab-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
              title={title}
            >
              <Icon size={16} />
              <span className="nav-tab-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* User Status & Role Switcher */}
        <div className="nav-actions">
          <div className="user-badge" title={isAdmin ? 'Full Fleet Access' : 'Delegated Operator'}>
            <div className={`user-avatar ${isAdmin ? 'admin' : 'operator'}`}>
              {isAdmin ? <ShieldCheck size={15} /> : <UserCheck size={15} />}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.full_name || user?.username}</div>
              <span className={`role-pill ${isAdmin ? 'admin' : 'operator'}`}>
                {user?.role}
              </span>
            </div>
          </div>

          {/* Quick Demo Switch Role Button */}
          <button 
            className="btn btn-secondary btn-sm nav-icon-btn"
            onClick={onSwitchRole}
            title={isAdmin ? 'Switch to VM Operator role for testing' : 'Switch to Admin role'}
          >
            <RefreshCw size={14} />
            <span className="nav-btn-label">{isAdmin ? 'Operator' : 'Admin'}</span>
          </button>

          <button 
            className="btn btn-secondary btn-sm nav-icon-btn"
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
