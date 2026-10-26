import React, { useState } from 'react';
import { Building2, Cpu, Database, HardDrive, Edit2, Check, X, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';

export default function TenantManagement({ tenants, onRefresh }) {
  const [editingTenant, setEditingTenant] = useState(null);
  const [maxCPU, setMaxCPU] = useState(64);
  const [maxRAM, setMaxRAM] = useState(256);
  const [maxStorage, setMaxStorage] = useState(2048);
  const [maxVMs, setMaxVMs] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (tenant) => {
    setEditingTenant(tenant);
    setMaxCPU(tenant.max_cpu);
    setMaxRAM(tenant.max_ram_gb);
    setMaxStorage(tenant.max_storage_gb);
    setMaxVMs(tenant.max_vms);
  };

  const handleSaveQuota = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateTenantQuota(editingTenant.id, {
        max_cpu: parseInt(maxCPU, 10),
        max_ram_gb: parseInt(maxRAM, 10),
        max_storage_gb: parseInt(maxStorage, 10),
        max_vms: parseInt(maxVMs, 10),
      });
      setEditingTenant(null);
      await onRefresh();
    } catch (err) {
      alert("Failed to update tenant quotas: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '26px' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Tenant & Resource Quotas</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
          Kelola batasan resource multi-tenant, kuota vCPU, RAM, Storage, dan batas maksimal VM.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        {tenants.map((tenant) => {
          const cpuPct = Math.round((tenant.used_cpu / tenant.max_cpu) * 100);
          const ramPct = Math.round((tenant.used_ram_gb / tenant.max_ram_gb) * 100);
          const storagePct = Math.round((tenant.used_storage_gb / tenant.max_storage_gb) * 100);
          const vmsPct = Math.round((tenant.used_vms / tenant.max_vms) * 100);

          return (
            <div key={tenant.id} className="glass-panel" style={{ padding: '26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '12px', 
                    background: '#eff6ff', 
                    color: '#1e3a8a', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1px solid #bfdbfe'
                  }}>
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{tenant.name}</h2>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      Identifier: <code style={{ color: '#1e3a8a', fontFamily: 'var(--font-mono)' }}>{tenant.slug}</code> • Status: <span style={{ color: '#059669', fontWeight: 700 }}>{tenant.status}</span>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => startEdit(tenant)}
                  title="Adjust Quota Limits"
                >
                  <Edit2 size={13} />
                  <span>Adjust Quota</span>
                </button>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.5 }}>
                {tenant.description}
              </p>

              {/* Quota Progress Meters */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '14px', 
                background: '#f8fafc', 
                padding: '18px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-subtle)' 
              }}>
                {/* VM Count */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Batas Alokasi Virtual Machine</span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{tenant.used_vms || 0} / {tenant.max_vms} VMs ({vmsPct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(vmsPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #0f172a, #1e3a8a)' }}></div>
                  </div>
                </div>

                {/* vCPU Cores */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Cpu size={13} color="#1e3a8a" /> vCPU Compute Pool
                    </span>
                    <span style={{ color: '#1e3a8a', fontWeight: 700 }}>{tenant.used_cpu || 0} / {tenant.max_cpu} vCPU ({cpuPct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(cpuPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #1e3a8a, #2563eb)' }}></div>
                  </div>
                </div>

                {/* RAM (GB) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Database size={13} color="#1e3a8a" /> RAM Allocation
                    </span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{tenant.used_ram_gb || 0} / {tenant.max_ram_gb} GB ({ramPct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(ramPct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #0f172a, #1e3a8a)' }}></div>
                  </div>
                </div>

                {/* Storage (GB) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <HardDrive size={13} color="#b45309" /> Storage Pool Limit
                    </span>
                    <span style={{ color: '#b45309', fontWeight: 700 }}>{tenant.used_storage_gb || 0} / {tenant.max_storage_gb} GB ({storagePct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(storagePct, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #b45309, #d97706)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Quota Dialog */}
      {editingTenant && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '490px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Modify Tenant Quotas</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {editingTenant.name}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingTenant(null)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuota}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Maximum vCPU Cores</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={maxCPU} 
                    onChange={(e) => setMaxCPU(e.target.value)}
                    min="1" 
                    max="1024"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Maximum RAM (GB)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={maxRAM} 
                    onChange={(e) => setMaxRAM(e.target.value)}
                    min="1" 
                    max="4096"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Maximum Storage (GB)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={maxStorage} 
                    onChange={(e) => setMaxStorage(e.target.value)}
                    min="10" 
                    max="20000"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Maximum Virtual Machines</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={maxVMs} 
                    onChange={(e) => setMaxVMs(e.target.value)}
                    min="1" 
                    max="500"
                    required 
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingTenant(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Menyimpan...' : 'Simpan Kuota Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
