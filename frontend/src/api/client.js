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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      return data;
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
      body: JSON.stringify({ action, force }),
    });
  }

  async requestConsoleSession(id) {
    return this.request(`/vms/${id}/console`, {
      method: 'POST',
    });
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
}

export const api = new ApiClient();
