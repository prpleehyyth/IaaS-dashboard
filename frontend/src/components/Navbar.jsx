import React from 'react';
import { 
  Sliders, 
  LayoutDashboard, 
  Server, 
  HardDrive, 
  Receipt, 
  Users, 
  LogOut, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onSwitchRole, onLogout }) {
  const isAdmin = user?.role === 'ADMIN';

  // Navigation tabs for PT PAL Private Cloud Panel
  const tabs = [
    { id: 'overview', label: 'Overview', title: 'Overview', icon: LayoutDashboard },
    { id: 'clusters', label: 'Clusters', title: 'Clusters & Compute Nodes', icon: Server },
    { id: 'vms', label: 'VM Fleet', title: 'Virtual Machines', icon: HardDrive },
    ...(isAdmin ? [
      { id: 'users', label: 'Users', title: 'Users & VM Access', icon: Users },
      { id: 'billing-rates', label: 'Atur Tarif', title: 'Atur Tarif CPU, Storage & Network', icon: Sliders },
    ] : []),
    { id: 'billing', label: 'Billing', title: 'Laporan Billing & Biaya VM', icon: Receipt },
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand with PT PAL Indonesia Logo */}
        <div className="nav-brand">
          <div className="brand-logo-badge">
            <img src="/pt-pal-logo.png" alt="PT PAL Indonesia" className="brand-logo-img" />
          </div>
          <div className="brand-text">
            <div className="brand-title">Private Cloud Panel</div>
            <div className="brand-subtitle">PT PAL Indonesia</div>
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
