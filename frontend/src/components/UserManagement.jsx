import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  HardDrive, 
  Trash2, 
  Key, 
  Check, 
  X, 
  AlertCircle,
  Server
} from 'lucide-react';
import { api } from '../api/client';

export default function UserManagement({ users, vms, tenants, onRefresh, showToast }) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assigningUser, setAssigningUser] = useState(null);
  const [selectedVMs, setSelectedVMs] = useState([]);
  
  // New User Form State
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [tenantId, setTenantId] = useState(tenants[0]?.id || '');
  const [initialVMs, setInitialVMs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const openAssignModal = (user) => {
    setAssigningUser(user);
    setSelectedVMs(user.assigned_vm_ids || []);
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
      await api.assignVMsToUser(assigningUser.id, selectedVMs);
      showToast(`Updated VM access permissions for ${assigningUser.username}`);
      setAssigningUser(null);
      await onRefresh();
    } catch (err) {
      alert("Failed to assign VMs: " + err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      await api.createUser({
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password: password,
        role: role,
        tenant_id: tenantId || null,
        assigned_vms: role === 'OPERATOR' ? initialVMs : [],
      });
      showToast(`User '${username}' created successfully`);
      setIsCreateModalOpen(false);
      // Reset form
      setUsername('');
      setFullName('');
      setEmail('');
      setPassword('');
      setInitialVMs([]);
      await onRefresh();
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user '${user.username}'?`)) return;
    try {
      await api.deleteUser(user.id);
      showToast(`User '${user.username}' deleted`);
      await onRefresh();
    } catch (err) {
      alert("Cannot delete user: " + err.message);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>User Access & VM Assignment</h1>
            <span style={{ fontSize: '0.85rem', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--accent-cyan)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
              {users.length} Registered Accounts
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Create cloud administrators or assign virtual machine permissions to VM Operators.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <UserPlus size={16} />
          <span>Add New User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>System Role</th>
              <th>Organization</th>
              <th>Accessible Virtual Machines</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isAdmin = u.role === 'ADMIN';

              return (
                <tr key={u.id}>
                  {/* User info */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '8px', 
                        background: isAdmin ? 'rgba(0, 242, 254, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isAdmin ? 'var(--accent-cyan)' : 'var(--accent-emerald)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isAdmin ? <ShieldCheck size={18} /> : <UserCheck size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{u.full_name || u.username}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>@{u.username} • {u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td>
                    <span className={`role-pill ${isAdmin ? 'admin' : 'operator'}`}>
                      {u.role}
                    </span>
                  </td>

                  {/* Tenant */}
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {u.tenant_name || 'Enterprise Cloud'}
                  </td>

                  {/* Accessible VMs */}
                  <td>
                    {isAdmin ? (
                      <span style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        All Infrastructure (12 VMs across 4 Clusters)
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.82rem', 
                          fontWeight: 700, 
                          color: u.assigned_vm_count > 0 ? 'var(--accent-emerald)' : 'var(--text-dim)',
                          background: u.assigned_vm_count > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          {u.assigned_vm_count || 0} Assigned VMs
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          (Start, Stop & Console)
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>
                      ● Active
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {!isAdmin && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => openAssignModal(u)}
                          title="Assign Accessible Virtual Machines"
                        >
                          <HardDrive size={13} />
                          <span>Assign VMs</span>
                        </button>
                      )}

                      {u.username !== 'admin' && (
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteUser(u)}
                          title="Delete User"
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
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Create New Account</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Register Cloud Admin or VM Operator with custom VM assignments
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsCreateModalOpen(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {formError && (
                  <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '10px 14px', borderRadius: '8px', color: '#fb7185', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. devops-john"
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="john@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">System Role</label>
                    <select 
                      className="form-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="OPERATOR">VM Operator (Start, Stop, Console)</option>
                      <option value="ADMIN">Administrator (Full Control)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tenant Organization</label>
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
                  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                        Assign Initial Virtual Machines ({initialVMs.length} selected):
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
                            borderRadius: '6px', 
                            background: initialVMs.includes(vm.id) ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${initialVMs.includes(vm.id) ? 'rgba(0, 242, 254, 0.3)' : 'transparent'}`,
                            cursor: 'pointer' 
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="checkbox" 
                              checked={initialVMs.includes(vm.id)} 
                              onChange={() => toggleInitialVM(vm.id)} 
                              style={{ accentColor: 'var(--accent-cyan)' }}
                            />
                            <div>
                              <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{vm.name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '8px' }}>({vm.ip_address})</span>
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
                  {isSubmitting ? 'Creating...' : 'Create Account'}
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
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Assign Virtual Machines</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Assigning access for Operator: <strong style={{ color: '#fff' }}>@{assigningUser.username}</strong> ({assigningUser.full_name})
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setAssigningUser(null)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Quick Select Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Selected: <strong style={{ color: 'var(--accent-cyan)' }}>{selectedVMs.length}</strong> of {vms.length} VMs
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    onClick={() => setSelectedVMs(vms.map(v => v.id))}
                  >
                    Select All
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
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
                        borderRadius: '8px',
                        background: isChecked ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isChecked ? 'rgba(0, 242, 254, 0.35)' : 'var(--border-subtle)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVMSelection(vm.id)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
                            {vm.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                            Node: {vm.node_id} • IP: {vm.ip_address} • {vm.cpu_cores} vCPU, {Math.round(vm.ram_mb / 1024)}GB
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
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveAssignments}>
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
