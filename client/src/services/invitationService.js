import axios from 'axios';
import { storageService } from './storageService';

const MODE = import.meta.env.VITE_APP_MODE === 'prototype' ? 'prototype' : 'production';

export const invitationService = {
  async getDashboardStats() {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      
      const stats = {
        totalInvitations: db.invitations.length,
        totalRecipients: db.recipients.length,
        sent: db.recipients.filter(r => r.responseStatus !== 'NOT_SENT').length,
        notViewed: db.recipients.filter(r => ['NOT_SENT', 'SENT', 'DELIVERED'].includes(r.responseStatus)).length,
        viewed: db.recipients.filter(r => !['NOT_SENT', 'SENT', 'DELIVERED'].includes(r.responseStatus)).length,
        accepted: db.recipients.filter(r => r.responseStatus === 'ACCEPTED').length,
        maybe: db.recipients.filter(r => r.responseStatus === 'MAYBE').length,
        declined: db.recipients.filter(r => r.responseStatus === 'DECLINED').length,
        checkedIn: db.recipients.filter(r => r.checkedIn).length
      };
      
      return stats;
    } else {
      // TODO: Production Backend Integration
      const res = await axios.get('/api/invitations/stats');
      return res.data;
    }
  },
  
  async getInvitations() {
    if (MODE === 'prototype') {
      return storageService.getData().invitations;
    } else {
      const res = await axios.get('/api/invitations');
      return res.data;
    }
  },
  
  async createInvitation(data) {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      const newInv = {
        id: db.invitations.length + 1,
        ...data,
        status: 'ACTIVE'
      };
      db.invitations.push(newInv);
      storageService.saveData(db);
      return newInv;
    }
  }
};
