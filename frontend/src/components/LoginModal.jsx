import React, { useState } from 'react';
import { Compass, Lock, User, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

export default function LoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.login(username, password);
      onLoginSuccess(resp.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userType) => {
    setError('');
    setLoading(true);
    const u = userType === 'ADMIN' ? 'admin' : 'operator';
    const p = userType === 'ADMIN' ? 'admin123' : 'operator123';
    setUsername(u);
    setPassword(p);
    try {
      const resp = await api.login(u, p);
      onLoginSuccess(resp.user);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%)' }}>
      <div className="modal-content" style={{ maxWidth: '450px', padding: '34px' }}>
        {/* Brand Icon with Maritime Compass */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '16px', 
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-ocean)',
            border: '1px solid #bfdbfe',
            marginBottom: '16px'
          }}>
            <Compass size={32} color="#ffffff" strokeWidth={2.5} />
          </div>
          <h2 style={{ 
            fontSize: '1.65rem', 
            fontWeight: 800, 
            background: 'linear-gradient(90deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em'
          }}>
            CloudForge IaaS
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '5px' }}>
            Maritime Hybrid Cloud • VMware vSphere & Proxmox VE
          </p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            padding: '11px 15px', 
            borderRadius: '9px', 
            color: '#dc2626', 
            fontSize: '0.85rem', 
            marginBottom: '20px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Login Preset Buttons */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ 
            fontSize: '0.78rem', 
            color: 'var(--text-dim)', 
            marginBottom: '10px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.06em', 
            textAlign: 'center',
            fontWeight: 600
          }}>
            Maritime Access Presets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('ADMIN')}
              disabled={loading}
              style={{ 
                padding: '12px 10px', 
                flexDirection: 'column', 
                gap: '4px', 
                textAlign: 'center', 
                borderColor: '#bfdbfe',
                background: '#eff6ff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e3a8a', fontWeight: 700 }}>
                <ShieldCheck size={16} />
                <span>Admiralty Admin</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Full Fleet Control</span>
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('OPERATOR')}
              disabled={loading}
              style={{ 
                padding: '12px 10px', 
                flexDirection: 'column', 
                gap: '4px', 
                textAlign: 'center', 
                borderColor: '#bfdbfe',
                background: '#eff6ff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb', fontWeight: 700 }}>
                <UserCheck size={16} />
                <span>VM Operator</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Power / Web Console</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>OR OFFICER CREDENTIALS</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="#1e3a8a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="form-input" 
                style={{ paddingLeft: '38px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin or operator"
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '26px' }}>
            <label className="form-label">Security Key / Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#1e3a8a" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="password" 
                className="form-input" 
                style={{ paddingLeft: '38px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
          >
            {loading ? 'Authenticating Officer...' : 'Authorize & Enter Bridge Deck'}
          </button>
        </form>
      </div>
    </div>
  );
}
