import { seedData } from '../data/seedData';

const DB_KEY = 'invitation_app_data';

export const storageService = {
  initialize() {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
      localStorage.setItem(DB_KEY, JSON.stringify(seedData));
    }
  },
  
  resetData() {
    localStorage.setItem(DB_KEY, JSON.stringify(seedData));
    localStorage.removeItem('demo_auth_user');
  },

  getData() {
    this.initialize();
    return JSON.parse(localStorage.getItem(DB_KEY));
  },

  saveData(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  },

  // Helper for auth
  getAuthUser() {
    const userStr = localStorage.getItem('demo_auth_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setAuthUser(user) {
    if (user) {
      localStorage.setItem('demo_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('demo_auth_user');
    }
  }
};
