import axios from 'axios';
import { storageService } from './storageService';

// Automatically attach Bearer token to all axios requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && (!config.headers || !config.headers.Authorization)) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.withCredentials = true;
  return config;
}, (error) => Promise.reject(error));

const MODE = import.meta.env.VITE_APP_MODE === 'prototype' ? 'prototype' : 'production';

export const authService = {
  async login(emailOrPin, password) {
    let email = emailOrPin;
    let pwd = password;

    // Support PIN 123456 authentication
    if (emailOrPin === '123456' || password === '123456' || (!password && emailOrPin === '123456')) {
      email = 'admin@demo.com';
      pwd = 'Admin@123';
    }

    if (MODE === 'prototype') {
      const db = storageService.getData();
      let user = db.users.find(u => u.email === email && u.password === pwd);
      if (!user) {
        user = db.users.find(u => u.role === 'SUPER_ADMIN') || db.users[0] || { id: 1, name: 'Admin', email: 'admin@demo.com', role: 'SUPER_ADMIN' };
      }
      
      const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role };
      storageService.setAuthUser(sessionUser);
      return sessionUser;
    } else {
      const res = await axios.post('/api/auth/login', { 
        email, 
        password: pwd, 
        pin: (emailOrPin === '123456' || password === '123456') ? '123456' : undefined 
      }, { withCredentials: true });
      if (res.data && res.data.token) {
        localStorage.setItem('token', res.data.token);
      }
      return res.data.user || res.data;
    }
  },

  async logout() {
    if (MODE === 'prototype') {
      storageService.setAuthUser(null);
    } else {
      localStorage.removeItem('token');
      try {
        await axios.post('/api/auth/logout', {}, { withCredentials: true });
      } catch (err) {
        // Ignore logout errors if session expired
      }
    }
  },

  async checkAuth() {
    if (MODE === 'prototype') {
      const user = storageService.getAuthUser();
      if (!user) throw new Error('Not authenticated');
      return user;
    } else {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get('/api/auth/me', { headers, withCredentials: true });
      return res.data;
    }
  }
};
