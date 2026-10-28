const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('iaas_token') || null;
    this.user = JSON.parse(localStorage.getItem('iaas_user') || 'null');
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('iaas_token', token);
      localStorage.setItem('iaas_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('iaas_token');
      localStorage.removeItem('iaas_user');
    }
  }

  getToken() {
    return this.token;
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return !!this.token;
  }

  isAdmin() {
    return this.user?.role === 'ADMIN';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        this.setSession(null, null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('Session expired or unauthorized. Please log in again.');
      }

      let data = null;
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || `HTTP error ${response.status}`);
      }

      return data || {};
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  }

  // Auth Endpoints
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setSession(data.token, data.user);
    return data;
  }

  logout() {
    this.setSession(null, null);
  }

  // Dashboard & Cluster Endpoints
  async getDashboardSummary() {
    return this.request('/dashboard/summary');
  }

  async getClusters() {
    return this.request('/clusters');
  }

  async getCluster(id) {
    return this.request(`/clusters/${id}`);
  }

  async getClusterISOs(clusterId, nodeId) {
    const qs = nodeId ? `?node=${encodeURIComponent(nodeId)}` : '';
    return this.request(`/clusters/${clusterId}/isos${qs}`);
  }

  async createCluster(payload) {
    return this.request('/clusters', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async testClusterConnection(payload) {
    return this.request('/clusters/test-connection', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async syncCluster(id) {
    return this.request(`/clusters/${id}/sync`, {
      method: 'POST',
    });
  }

  async deleteCluster(id) {
    return this.request(`/clusters/${id}`, {
      method: 'DELETE',
    });
  }

  async addNode(clusterId, payload) {
    return this.request(`/clusters/${clusterId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteNode(clusterId, nodeId) {
    return this.request(`/clusters/${clusterId}/nodes/${nodeId}`, {
      method: 'DELETE',
    });
  }

  async resetVirgin() {
    return this.request('/system/reset-virgin', {
      method: 'POST',
    });
  }

  // Virtual Machine Endpoints
  async getVMs() {
    return this.request('/vms');
  }

  async getVM(id) {
    return this.request(`/vms/${id}`);
  }

  async createVM(payload) {
    return this.request('/vms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateVM(id, payload) {
    return this.request(`/vms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteVM(id) {
    return this.request(`/vms/${id}`, {
      method: 'DELETE',
    });
  }

  async executeVMAction(id, action, force = false) {
    return this.request(`/vms/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: (action || '').toLowerCase(), force }),
    });
  }

  async rebuildVM(id, payload) {
    return this.request(`/vms/${id}/rebuild`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getVMTelemetry(id) {
    return this.request(`/vms/${id}/telemetry`);
  }

  async getFleetTelemetry() {
    return this.request('/vms/telemetry');
  }

  async requestConsoleSession(id) {
    return this.request(`/vms/${id}/console`, {
      method: 'POST',
    });
  }

  async createConsoleSession(id) {
    return this.requestConsoleSession(id);
  }

  getConsoleWsUrl(tokenOrUrl, vmId) {
    if (typeof tokenOrUrl === 'string') {
      if (tokenOrUrl.startsWith('ws://') || tokenOrUrl.startsWith('wss://')) {
        return tokenOrUrl;
      }
      if (tokenOrUrl.startsWith('http://')) {
        return tokenOrUrl.replace('http://', 'ws://');
      }
      if (tokenOrUrl.startsWith('https://')) {
        return tokenOrUrl.replace('https://', 'wss://');
      }
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // If it's already a full relative path like /api/v1/vms/.../ws?ticket=...
    if (typeof tokenOrUrl === 'string' && tokenOrUrl.startsWith('/')) {
      return `${proto}//${host}${tokenOrUrl}`;
    }

    const ticket = tokenOrUrl || '';
    if (vmId) {
      return `${proto}//${host}/api/v1/vms/${vmId}/console/ws?ticket=${ticket}`;
    }
    return `${proto}//${host}/api/v1/vms/console/ws?ticket=${ticket}`;
  }

  // Tenant & Metering Endpoints
  async getTenants() {
    return this.request('/tenants');
  }

  async updateTenantQuota(id, payload) {
    return this.request(`/tenants/${id}/quota`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getMeteringSummary() {
    return this.request('/metering/summary');
  }

  async getBillingReport() {
    return this.request('/billing/report');
  }

  async getBillingRates() {
    return this.request('/billing/rates');
  }

  async updateBillingRates(payload) {
    return this.request('/billing/rates', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // User Management Endpoints (Admin Only)
  async getUsers() {
    return this.request('/users');
  }

  async createUser(payload) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async assignVMsToUser(userId, vmIds) {
    return this.request(`/users/${userId}/vms`, {
      method: 'PUT',
      body: JSON.stringify({ vm_ids: vmIds }),
    });
  }

  async deleteUser(userId) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Audit Logs Endpoint (Pagination, Filter, Export)
  async getAuditLogs(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', params.page);
    if (params.limit !== undefined) qs.append('limit', params.limit);
    if (params.search) qs.append('search', params.search);
    if (params.action && params.action !== 'ALL') qs.append('action', params.action);
    if (params.status && params.status !== 'ALL') qs.append('status', params.status);
    if (params.export) qs.append('export', 'true');
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/audit-logs${query}`);
  }
}

export const api = new ApiClient();
export default api;
