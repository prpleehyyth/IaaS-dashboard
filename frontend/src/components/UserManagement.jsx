import React, { useState } from 'react';
import { Users, UserPlus, ShieldCheck, UserCheck, Trash2, Key, HardDrive, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';

export default function UserManagement({ users, vms, tenants, onRefresh, showToast }) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assigningUser, setAssigningUser] = useState(null);
  const [selectedVMs, setSelectedVMs] = useState([]);
  const [syncingUserId, setSyncingUserId] = useState(null);

  // Form State for User Creation
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [tenantId, setTenantId] = useState(tenants[0]?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  const [initialVMs, setInitialVMs] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open Assign Modal
  const openAssignModal = async (targetUser) => {
    setAssigningUser(targetUser);
    setSelectedVMs(targetUser.assigned_vm_ids || []);
    try {
      const assigned = await api.getUserVMs(targetUser.id);
      if (Array.isArray(assigned)) {
        setSelectedVMs(assigned.map(v => v.id));
      }
    } catch (err) {
      console.error("Failed to load user's VMs:", err);
    }
  };

  const toggleVMSelection = (vmId) => {
    setSelectedVMs(prev => 
      prev.includes(vmId) ? prev.filter(id => id !== vmId) : [...prev, vmId]
    );
  };

  const toggleInitialVM = (vmId) => {
    setInitialVMs(prev => 
      prev.includes(vmId) ? prev.filter(id => id !== vmId) : [...prev, vmId]
    );
  };

  const handleSaveAssignments = async () => {
    try {
      const res = await api.assignVMsToUser(assigningUser.id, selectedVMs);
      showToast(res.message || `Updated VM access & Proxmox ACLs for ${assigningUser.username}@pve`);
      setAssigningUser(null);
      await onRefresh();
    } catch (err) {
      showToast("Failed to assign VMs: " + err.message, 'error');
    }
  };

  const handleSyncProxmox = async (targetUser) => {
    setSyncingUserId(targetUser.id);
    try {
      const res = await api.syncUserToProxmox(targetUser.id);
      showToast(res.message || `Synced ${targetUser.username}@pve to Proxmox VE`);
      await onRefresh();
    } catch (err) {
      showToast("Proxmox sync error: " + err.message, 'error');
    } finally {
      setSyncingUserId(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const validTenantId = tenants.find(t => t.id === tenantId)?.id || tenants[0]?.id || undefined;
      const newUser = await api.createUser({
        username,
        full_name: fullName,
        email,
        password,
        role,
        tenant_id: validTenantId,
        assigned_vms: role === 'OPERATOR' ? initialVMs : [],
      });

      const syncInfo = newUser.proxmox_sync_msg ? ` (${newUser.proxmox_sync_msg})` : '';
      showToast(`User '${newUser.username}' created${syncInfo}`);
      setIsCreateModalOpen(false);
      setUsername('');
      setFullName('');
      setEmail('');
      setPassword('');
      setInitialVMs([]);
      await onRefresh();
    } catch (err) {
      setFormError(err.message || "Failed to create user account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Permanently revoke and delete account '${targetUser.username}' (including '${targetUser.proxmox_user_id || targetUser.username + '@pve'}' on Proxmox VE)?`)) {
      return;
    }

    try {
      await api.deleteUser(targetUser.id);
      showToast(`Account '${targetUser.username}' removed from dashboard & Proxmox VE`);
      await onRefresh();
    } catch (err) {
      showToast("Failed to delete user: " + err.message, 'error');
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>Manajemen Pengguna & Akses VM</h1>
            <span style={{ 
              fontSize: '0.82rem', 
              background: '#eff6ff', 
              color: '#1e3a8a', 
              border: '1px solid #bfdbfe', 
              padding: '4px 12px', 
              borderRadius: '8px', 
              fontWeight: 700 
            }}>
              {users.length} Registered Accounts
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
<<<<<<< HEAD
            Authorize fleet officers (Admiralty Admin) or delegate vessel command to VM Operators — automatically synced with Proxmox VE (<code>@pve</code> realm &amp; <code>/vms/&lt;vmid&gt;</code> ACLs).
=======
            Kelola akun Administrator dan delegasikan izin kontrol VM kepada VM Operator.
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
          style={{ padding: '10px 20px' }}
        >
          <UserPlus size={17} strokeWidth={2.4} />
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
<<<<<<< HEAD
              <th>Personnel</th>
              <th>Rank &amp; Proxmox Realm</th>
              <th>Division / Organization</th>
              <th>Authorized Vessels &amp; Proxmox ACL</th>
=======
              <th>Nama & Username</th>
              <th>Role</th>
              <th>Organisasi / Tenant</th>
              <th>Akses Virtual Machine (VM)</th>
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isAdmin = u.role === 'ADMIN';
              const pveUser = u.proxmox_user_id || `${u.username}@pve`;

              return (
                <tr key={u.id}>
                  {/* User info */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '38px', 
                        height: '38px', 
                        borderRadius: '10px', 
                        background: isAdmin ? '#fef3c7' : '#eff6ff',
                        color: isAdmin ? '#b45309' : '#1e3a8a',
                        border: isAdmin ? '1px solid #fde68a' : '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isAdmin ? <ShieldCheck size={19} /> : <UserCheck size={19} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{u.full_name || u.username}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{u.username} • {u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Role & Proxmox UserID */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                      <span className={`role-pill ${isAdmin ? 'admin' : 'operator'}`}>
                        {u.role}
                      </span>
                      <span style={{
                        fontSize: '0.73rem',
                        fontFamily: 'monospace',
                        background: '#fff7ed',
                        color: '#c2410c',
                        border: '1px solid #fed7aa',
                        padding: '1px 7px',
                        borderRadius: '5px',
                        fontWeight: 700
                      }}>
                        PVE: {pveUser}
                      </span>
                    </div>
                  </td>

                  {/* Tenant */}
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
<<<<<<< HEAD
                    {u.tenant_name || 'Default Organization'}
=======
                    {u.tenant_name || 'Organisasi Utama'}
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
                  </td>

                  {/* Accessible VMs */}
                  <td>
                    {isAdmin ? (
<<<<<<< HEAD
                      <div>
                        <span style={{ fontSize: '0.84rem', color: '#b45309', fontWeight: 700 }}>
                          All Fleet Vessels ({vms.length} VMs)
=======
                      <span style={{ fontSize: '0.84rem', color: '#b45309', fontWeight: 700 }}>
                        Semua Virtual Machine (Akses Penuh)
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.82rem', 
                          fontWeight: 700, 
                          color: u.assigned_vm_count > 0 ? '#059669' : 'var(--text-dim)',
                          background: u.assigned_vm_count > 0 ? '#ecfdf5' : '#ffffff',
                          border: u.assigned_vm_count > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                          padding: '3px 10px',
                          borderRadius: '6px'
                        }}>
                          {u.assigned_vm_count || 0} VM Ditugaskan
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
                        </span>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontFamily: 'monospace', marginTop: '2px' }}>
                          ACL: path=/ • role=PVEAdmin
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            fontSize: '0.82rem', 
                            fontWeight: 700, 
                            color: u.assigned_vm_count > 0 ? '#059669' : 'var(--text-dim)',
                            background: u.assigned_vm_count > 0 ? '#ecfdf5' : '#ffffff',
                            border: u.assigned_vm_count > 0 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
                            padding: '3px 10px',
                            borderRadius: '6px'
                          }}>
                            {u.assigned_vm_count || 0} Assigned Vessels
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            (Power &amp; Console)
                          </span>
                        </div>
                        <span style={{ fontSize: '0.73rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                          ACL: path=/vms/&lt;vmid&gt; • role=PVEVMUser
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 700 }}>
                      ● Active Duty
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSyncProxmox(u)}
                        disabled={syncingUserId === u.id}
                        title={`Sync ${pveUser} & VM ACLs to Proxmox VE`}
                        style={{ color: '#c2410c', borderColor: '#fed7aa', background: '#fff7ed' }}
                      >
                        <RefreshCw size={13} className={syncingUserId === u.id ? 'spin' : ''} />
                        <span>{syncingUserId === u.id ? 'Syncing...' : 'Sync PVE'}</span>
                      </button>

                      {!isAdmin && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => openAssignModal(u)}
                          title="Tugaskan Virtual Machine ke Operator"
                          style={{ color: 'var(--text-main)' }}
                        >
                          <HardDrive size={13} color="#1e3a8a" />
                          <span>Tugaskan VM</span>
                        </button>
                      )}

                      {u.username !== 'admin' && (
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteUser(u)}
                          title="Decommission Account"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Create New User */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Tambah Pengguna Baru</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
<<<<<<< HEAD
                  Creates dashboard account and provisions <code>{username ? `${username}@pve` : '<username>@pve'}</code> in Proxmox VE
=======
                  Daftarkan Administrator atau VM Operator dengan penugasan VM yang dipilih
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsCreateModalOpen(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Username (Proxmox <code>@pve</code> ID)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. operator-john"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="operator@cloud.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Security Password (Dashboard &amp; Proxmox)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Role Pengguna</label>
                    <select 
                      className="form-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
<<<<<<< HEAD
                      <option value="OPERATOR">VM Operator (Proxmox Role: PVEVMUser)</option>
                      <option value="ADMIN">Admiralty Administrator (Proxmox Role: PVEAdmin)</option>
=======
                      <option value="OPERATOR">VM Operator (Power, Console Control)</option>
                      <option value="ADMIN">Administrator (Full Access)</option>
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Division / Tenant</label>
                    <select 
                      className="form-select"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                    >
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* If role is OPERATOR, allow immediate VM assignment */}
                {role === 'OPERATOR' && (
                  <div style={{ marginTop: '10px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
<<<<<<< HEAD
                        Assign Initial Fleet Vessels &amp; Proxmox ACLs ({initialVMs.length} selected):
=======
                        Penugasan Awal Virtual Machine ({initialVMs.length} dipilih):
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
                      </span>
                    </div>

                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {vms.map(vm => (
                        <label 
                          key={vm.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '8px 12px', 
                            borderRadius: '8px', 
                            background: initialVMs.includes(vm.id) ? '#eff6ff' : '#ffffff',
                            border: `1px solid ${initialVMs.includes(vm.id) ? 'rgba(56, 189, 248, 0.45)' : 'transparent'}`,
                            cursor: 'pointer' 
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="checkbox" 
                              checked={initialVMs.includes(vm.id)} 
                              onChange={() => toggleInitialVM(vm.id)} 
                              style={{ accentColor: 'var(--ocean-blue)' }}
                            />
                            <div>
                              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{vm.name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '8px' }}>
                                ({vm.ip_address}{vm.hypervisor_type === 'PROXMOX' && vm.vmid ? ` • ACL: /vms/${vm.vmid}` : ''})
                              </span>
                            </div>
                          </div>
                          <span className={vm.hypervisor_type === 'VMWARE' ? 'badge-vmware' : 'badge-proxmox'} style={{ fontSize: '0.7rem' }}>
                            {vm.hypervisor_type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
<<<<<<< HEAD
                  {isSubmitting ? 'Commissioning & Syncing...' : 'Authorize & Sync to Proxmox'}
=======
                  {isSubmitting ? 'Mendaftarkan...' : 'Buat Akun Pengguna'}
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign VMs to Existing Operator */}
      {assigningUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div>
<<<<<<< HEAD
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Assign Fleet Vessels &amp; Proxmox ACLs</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Operator: <strong style={{ color: 'var(--text-main)' }}>@{assigningUser.username}</strong> • Proxmox ID: <code>{assigningUser.proxmox_user_id || `${assigningUser.username}@pve`}</code> (Role: <code>PVEVMUser</code>)
=======
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Tugaskan Virtual Machine (VM)</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Memberikan izin kontrol VM untuk Operator: <strong style={{ color: 'var(--text-main)' }}>@{assigningUser.username}</strong> ({assigningUser.full_name})
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setAssigningUser(null)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Quick Select Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Dipilih: <strong style={{ color: '#1e3a8a' }}>{selectedVMs.length}</strong> dari {vms.length} Virtual Machine
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => setSelectedVMs(vms.map(v => v.id))}
                  >
                    Select All
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    onClick={() => setSelectedVMs([])}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* VM Checklist */}
              <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {vms.map((vm) => {
                  const isChecked = selectedVMs.includes(vm.id);
                  const isVMware = vm.hypervisor_type === 'VMWARE';

                  return (
                    <label
                      key={vm.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '9px',
                        background: isChecked ? '#eff6ff' : '#ffffff',
                        border: `1px solid ${isChecked ? 'rgba(56, 189, 248, 0.45)' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVMSelection(vm.id)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--ocean-blue)' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            {vm.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                            Node: {vm.node_id} • IP: {vm.ip_address} • {vm.cpu_cores} vCPU, {Math.round(vm.ram_mb / 1024)}GB
                            {!isVMware && vm.vmid > 0 && (
                              <span style={{ marginLeft: '6px', color: '#c2410c', fontFamily: 'monospace', fontWeight: 700 }}>
                                • PVE ACL: /vms/{vm.vmid}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`status-dot ${vm.status === 'RUNNING' ? 'running' : 'stopped'}`}></span>
                        <span className={isVMware ? 'badge-vmware' : 'badge-proxmox'} style={{ fontSize: '0.72rem' }}>
                          {vm.hypervisor_type}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAssigningUser(null)}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveAssignments}>
<<<<<<< HEAD
                Save &amp; Sync Proxmox ACLs
=======
                Simpan Penugasan VM
>>>>>>> 436fbfde5fd66f78e9d193a62e9451d1a24f0101
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
