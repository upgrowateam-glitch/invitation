import axios from 'axios';
import { storageService } from './storageService';

const MODE = import.meta.env.VITE_APP_MODE === 'prototype' ? 'prototype' : 'production';

export const recipientService = {
  async getRecipients() {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      return db.recipients.map(r => {
        const inv = db.invitations.find(i => i.id === r.invitationId);
        const sender = db.users.find(u => u.id === r.senderId);
        return { 
          ...r, 
          invitationTitle: inv ? inv.title : 'Special Event',
          senderName: r.senderName || (sender ? sender.name : 'Sender')
        };
      });
    } else {
      const res = await axios.get('/api/recipients');
      return res.data;
    }
  },

  async addRecipient(data) {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      const newRec = {
        id: db.recipients.length + 1,
        ...data,
        token: Math.random().toString(36).substring(2, 15),
        responseStatus: 'SENT',
        sentDate: new Date().toISOString()
      };
      db.recipients.push(newRec);
      storageService.saveData(db);
      return newRec;
    } else {
      const res = await axios.post('/api/recipients', data);
      return res.data;
    }
  },

  async getInvitationByToken(token) {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      const recipient = db.recipients.find(r => r.token === token);
      if (!recipient) throw new Error('Invalid or expired invitation link');
      const invitation = db.invitations.find(i => i.id === recipient.invitationId) || db.invitations[0];
      return { recipient, invitation };
    } else {
      const res = await axios.get(`/api/public/invitation/${token}`);
      return res.data;
    }
  },
  
  async submitRsvp(token, { status, guests, notes }) {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      const recipient = db.recipients.find(r => r.token === token);
      if (recipient) {
        recipient.responseStatus = status;
        recipient.attendingGuests = guests || 0;
        recipient.notes = notes;
        recipient.responseDate = new Date().toISOString();
        storageService.saveData(db);
      }
    } else {
      const res = await axios.post(`/api/public/invitation/${token}/rsvp`, { status, guests, notes });
      return res.data;
    }
  }
};
