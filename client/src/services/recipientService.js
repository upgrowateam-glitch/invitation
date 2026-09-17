import axios from 'axios';
import { storageService } from './storageService';
import { v4 as uuidv4 } from 'uuid';

const MODE = import.meta.env.VITE_APP_MODE === 'prototype' ? 'prototype' : 'production';

export const recipientService = {
  async getRecipients() {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      // Join with invitation data and sender data for display
      return db.recipients.map(r => {
        const inv = db.invitations.find(i => i.id === r.invitationId);
        const sender = db.users.find(u => u.id === r.senderId);
        return { 
          ...r, 
          invitationTitle: inv ? inv.title : 'Unknown',
          senderName: sender ? sender.name : 'Unknown'
        };
      });
    } else {
      // TODO: Production Backend Integration
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
        token: uuidv4(),
        responseStatus: 'SENT',
        sentDate: new Date().toISOString()
      };
      db.recipients.push(newRec);
      storageService.saveData(db);
      return newRec;
    }
  },
  
  async simulateSend(id) {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      const rec = db.recipients.find(r => r.id === id);
      if (rec) {
        rec.responseStatus = 'SENT';
        
        db.activities.push({
          id: db.activities.length + 1,
          recipientId: id,
          action: 'SIMULATED_SEND',
          timestamp: new Date().toISOString()
        });
        
        storageService.saveData(db);
      }
      return rec;
    }
  },

  async getInvitationByToken(token) {
    if (MODE === 'prototype') {
      const db = storageService.getData();
      const recipient = db.recipients.find(r => r.token === token);
      
      if (!recipient) throw new Error('Invalid or expired invitation link');
      
      const invitation = db.invitations.find(i => i.id === recipient.invitationId);
      
      // Update view status
      if (['NOT_SENT', 'SENT', 'DELIVERED'].includes(recipient.responseStatus)) {
        recipient.responseStatus = 'VIEWED';
        if (!recipient.firstViewedDate) recipient.firstViewedDate = new Date().toISOString();
        
        db.activities.push({
          id: db.activities.length + 1,
          recipientId: recipient.id,
          action: 'VIEWED',
          timestamp: new Date().toISOString()
        });
        storageService.saveData(db);
      }
      
      return { recipient, invitation };
    } else {
      // TODO: Production Backend Integration
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
        
        db.activities.push({
          id: db.activities.length + 1,
          recipientId: recipient.id,
          action: `RSVP_${status}`,
          timestamp: new Date().toISOString()
        });
        
        storageService.saveData(db);
      }
    } else {
      // TODO: Production Backend Integration
      await axios.post(`/api/public/invitation/${token}/rsvp`, { status, guests, notes });
    }
  }
};
