import axios from 'axios';
import { storageService } from './storageService';

const MODE = import.meta.env.VITE_APP_MODE === 'prototype' ? 'prototype' : 'production';

export const authService = {
  async login(email, password) {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      const user = db.users.find(u => u.email === email && u.password === password);
      
      if (!user) {
        throw new Error('Invalid email or password');
      }
      
      const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role };
      storageService.setAuthUser(sessionUser);
      return sessionUser;
    } else {
      const res = await axios.post('/api/auth/login', { email, password }, { withCredentials: true });
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
