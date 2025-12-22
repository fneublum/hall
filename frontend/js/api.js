// HALL Frontend API Client
const API_BASE = window.location.origin + '/api';

class HallAPI {
  constructor() {
    this.token = localStorage.getItem('hall_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('hall_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('hall_token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async register(email, password, name) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
  }

  async getMe() {
    return this.request('/auth/me');
  }

  googleLogin() {
    window.location.href = `${API_BASE}/auth/google`;
  }

  // Accounts
  async getAccounts() {
    return this.request('/accounts');
  }

  async toggleAccount(id) {
    return this.request(`/accounts/${id}/toggle`, { method: 'PATCH' });
  }

  async updateAccount(id, data) {
    return this.request(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteAccount(id) {
    return this.request(`/accounts/${id}`, { method: 'DELETE' });
  }

  // Email
  async getEmails(maxResults = 20) {
    return this.request(`/email?maxResults=${maxResults}`);
  }

  async sendEmail(to, subject, body, accountId) {
    return this.request('/email/send', {
      method: 'POST',
      body: JSON.stringify({ to, subject, body, accountId })
    });
  }

  // Calendar
  async getCalendarEvents(maxResults = 20) {
    return this.request(`/calendar?maxResults=${maxResults}`);
  }

  async getTodayEvents() {
    return this.request('/calendar/today');
  }

  async createEvent(event) {
    return this.request('/calendar', {
      method: 'POST',
      body: JSON.stringify(event)
    });
  }

  // Tasks
  async getTasks() {
    return this.request('/tasks');
  }

  async createTask(task) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task)
    });
  }

  async updateTask(taskId, accountId, updates) {
    return this.request(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ accountId, ...updates })
    });
  }

  // Contacts
  async getContacts(maxResults = 100) {
    return this.request(`/contacts?maxResults=${maxResults}`);
  }

  async searchContacts(query) {
    return this.request(`/contacts/search?q=${encodeURIComponent(query)}`);
  }

  // Messages (SMS/WhatsApp)
  async getSMSMessages(limit = 20) {
    return this.request(`/messages/sms?limit=${limit}`);
  }

  async getWhatsAppMessages(limit = 20) {
    return this.request(`/messages/whatsapp?limit=${limit}`);
  }

  async sendSMS(to, body) {
    return this.request('/messages/sms', {
      method: 'POST',
      body: JSON.stringify({ to, body })
    });
  }

  async sendWhatsApp(to, body) {
    return this.request('/messages/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ to, body })
    });
  }

  // Chat (Claude AI)
  async chat(message, conversationId) {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId })
    });
  }

  async clearChat(conversationId) {
    return this.request(`/chat/${conversationId}`, { method: 'DELETE' });
  }

  // Dashboard
  async getDashboard() {
    return this.request('/dashboard');
  }
}

// Global instance
window.hallAPI = new HallAPI();

// Check for token in URL (after OAuth redirect)
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');
if (tokenFromUrl) {
  window.hallAPI.setToken(tokenFromUrl);
  window.history.replaceState({}, document.title, window.location.pathname);
}
