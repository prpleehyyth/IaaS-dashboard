import React, { useState } from 'react';
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
  UserCheck,
  Menu,
  X
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onSwitchRole, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  // Navigation tabs for PT PAL Private Cloud Panel
  const tabs = [
    { id: 'overview', label: 'Overview', title: 'Ringkasan Sistem & VM', icon: LayoutDashboard },
    ...(isAdmin ? [
      { id: 'clusters', label: 'Cluster & Host', title: 'Topologi Cluster & Server Fisik (Host)', icon: Server },
    ] : []),
    { id: 'vms', label: 'Virtual Machines', title: 'Daftar Virtual Machines', icon: HardDrive },
    ...(isAdmin ? [
      { id: 'users', label: 'Users', title: 'Manajemen Pengguna & Akses VM', icon: Users },
      { id: 'billing-rates', label: 'Atur Tarif', title: 'Atur Tarif CPU, Storage & Network', icon: Sliders },
      { id: 'billing', label: 'Billing', title: 'Laporan Billing & Biaya VM', icon: Receipt },
    ] : []),
  ];

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand with PT PAL Indonesia Logo */}
        <div className="nav-brand">
          <div className="brand-logo-badge">
            <img src="/pt-pal-logo.png" alt="PT PAL Indonesia" className="brand-logo-img" />
          </div>
          <div className="brand-text">
            <div className="brand-title">Private Cloud</div>
            <div className="brand-subtitle">PT PAL Indonesia</div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="nav-tabs desktop-only">
          {tabs.map(({ id, label, title, icon: Icon }) => (
            <button
              key={id}
              className={`nav-tab-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => handleSelectTab(id)}
              title={title}
            >
              <Icon size={15} />
              <span className="nav-tab-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* User Status & Role Switcher */}
        <div className="nav-actions">
          <div className="user-badge" title={isAdmin ? 'Akses Administrator Penuh' : 'Operator VM (Akses Terbatas)'}>
            <div className={`user-avatar ${isAdmin ? 'admin' : 'operator'}`}>
              {isAdmin ? <ShieldCheck size={14} /> : <UserCheck size={14} />}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.full_name || user?.username}</div>
              <span className={`role-pill ${isAdmin ? 'admin' : 'operator'}`}>
                {user?.role}
              </span>
            </div>
          </div>

          {/* Quick Demo Switch Role Button (Desktop) */}
          <button 
            className="btn btn-secondary btn-sm nav-icon-btn desktop-only"
            onClick={onSwitchRole}
            title={isAdmin ? 'Switch ke role Operator VM' : 'Switch ke role Admin'}
          >
            <RefreshCw size={13} />
            <span className="nav-btn-label">{isAdmin ? 'Mode Operator' : 'Mode Admin'}</span>
          </button>

          <button 
            className="btn btn-secondary btn-sm nav-icon-btn desktop-only"
            onClick={onLogout}
            title="Keluar"
          >
            <LogOut size={14} />
          </button>

          {/* Mobile Menu Hamburger Button */}
          <button 
            type="button"
            className="btn btn-secondary btn-sm mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{ padding: '7px 9px' }}
          >
            {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Tabs Bar (Always accessible touch swipe navigation on phones) */}
      <div className="mobile-tabs-bar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`mobile-tab-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => handleSelectTab(id)}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <div className="mobile-drawer-header">
            <div className="mobile-user-row">
              <div className={`user-avatar ${isAdmin ? 'admin' : 'operator'}`} style={{ width: '32px', height: '32px' }}>
                {isAdmin ? <ShieldCheck size={16} /> : <UserCheck size={16} />}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{user?.full_name || user?.username}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{user?.email || (isAdmin ? 'admin@cloud.local' : 'ops1@local.cloud')}</div>
              </div>
              <span className={`role-pill ${isAdmin ? 'admin' : 'operator'}`} style={{ marginLeft: 'auto' }}>
                {user?.role}
              </span>
            </div>
          </div>

          <div className="mobile-drawer-tabs">
            {tabs.map(({ id, label, title, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`mobile-drawer-tab-btn ${activeTab === id ? 'active' : ''}`}
                onClick={() => handleSelectTab(id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={16} />
                  <span style={{ fontWeight: 600 }}>{label}</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{title}</span>
              </button>
            ))}
          </div>

          <div className="mobile-drawer-footer">
            <button 
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, padding: '9px 12px', fontSize: '0.82rem' }}
              onClick={() => {
                onSwitchRole();
                setMobileMenuOpen(false);
              }}
            >
              <RefreshCw size={13} />
              <span>Ganti ke {isAdmin ? 'Operator' : 'Admin'}</span>
            </button>

            <button 
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '9px 14px', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
              title="Keluar"
            >
              <LogOut size={14} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
