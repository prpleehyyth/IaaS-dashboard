import React, { useState } from 'react';
import { Cloud, Lock, User, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
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
      setError(err.message || 'Login failed. Please check credentials.');
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
    <div className="modal-overlay" style={{ background: 'rgba(5, 8, 16, 0.92)' }}>
      <div className="modal-content" style={{ maxWidth: '440px', padding: '32px' }}>
        {/* Brand Icon */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '52px', 
            height: '52px', 
            borderRadius: '14px', 
            background: 'linear-gradient(135deg, var(--accent-gold) 0%, #0b4f8a 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-gold)',
            marginBottom: '14px'
          }}>
            <Cloud size={28} color="#070a12" strokeWidth={2.5} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>CloudForge IaaS</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Multi-Tenant VMware & Proxmox Private Cloud
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '10px 14px', borderRadius: '8px', color: '#fb7185', fontSize: '0.85rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Demo Login Preset Buttons */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
            Quick Demo Login Presets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('ADMIN')}
              disabled={loading}
              style={{ padding: '10px 8px', flexDirection: 'column', gap: '4px', textAlign: 'center', borderColor: 'rgba(191, 155, 48, 0.3)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold-lt)', fontWeight: 700 }}>
                <ShieldCheck size={16} />
                <span>Admin</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Full Lifecycle</span>
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('OPERATOR')}
              disabled={loading}
              style={{ padding: '10px 8px', flexDirection: 'column', gap: '4px', textAlign: 'center', borderColor: 'rgba(0, 178, 178, 0.3)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-teal-lt)', fontWeight: 700 }}>
                <UserCheck size={16} />
                <span>VM Operator</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Start/Stop/Console</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>OR CREDENTIALS</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="form-input" 
                style={{ paddingLeft: '36px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="password" 
                className="form-input" 
                style={{ paddingLeft: '36px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Cloud Console'}
          </button>
        </form>
      </div>
    </div>
  );
}
