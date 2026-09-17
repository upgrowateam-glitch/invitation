import axios from 'axios';
import { storageService } from './storageService';

const MODE = import.meta.env.VITE_APP_MODE || 'prototype';

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
      // Production API call
      // TODO: Production Backend Integration
      const res = await axios.post('/api/auth/login', { email, password });
      return res.data;
    }
  },

  async logout() {
    if (MODE === 'prototype') {
      storageService.setAuthUser(null);
    } else {
      // TODO: Production Backend Integration
      await axios.post('/api/auth/logout');
    }
  },

  async checkAuth() {
    if (MODE === 'prototype') {
      const user = storageService.getAuthUser();
      if (!user) throw new Error('Not authenticated');
      return user;
    } else {
      // TODO: Production Backend Integration
      const res = await axios.get('/api/auth/me');
      return res.data;
    }
  }
};
