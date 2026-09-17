const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getInvitations = async (req, res, next) => {
  try {
    const where = {};
    if (req.user.role === 'SENDER') {
      where.creatorId = req.user.id;
    }
    
    const invitations = await prisma.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(invitations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invitations', error: error.message });
  }
};

const getInvitation = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    const invitation = await prisma.invitation.findUnique({
      where: { id }
    });
    
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    
    if (req.user.role === 'SENDER' && invitation.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this invitation' });
    }
    
    res.json(invitation);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invitation', error: error.message });
  }
};

const createInvitation = async (req, res, next) => {
  try {
    const data = { ...req.body };
    
    // Convert date strings to Date objects if they exist
    if (data.eventDate) data.eventDate = new Date(data.eventDate);
    if (data.rsvpDeadline) data.rsvpDeadline = new Date(data.rsvpDeadline);
    
    // Set creatorId to current user
    data.creatorId = req.user.id;
    
    const invitation = await prisma.invitation.create({
      data
    });
    
    res.status(201).json(invitation);
  } catch (error) {
    res.status(500).json({ message: 'Error creating invitation', error: error.message });
  }
};

const updateInvitation = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const data = { ...req.body };
    
    // Convert date strings to Date objects if they exist
    if (data.eventDate) data.eventDate = new Date(data.eventDate);
    if (data.rsvpDeadline) data.rsvpDeadline = new Date(data.rsvpDeadline);
    
    const invitation = await prisma.invitation.findUnique({
      where: { id }
    });
    
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    
    if (req.user.role === 'SENDER' && invitation.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this invitation' });
    }
    
    // Prevent updating creatorId
    delete data.creatorId;
    
    const updatedInvitation = await prisma.invitation.update({
      where: { id },
      data
    });
    
    res.json(updatedInvitation);
  } catch (error) {
    res.status(500).json({ message: 'Error updating invitation', error: error.message });
  }
};

const deleteInvitation = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    const invitation = await prisma.invitation.findUnique({
      where: { id }
    });
    
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    
    if (req.user.role === 'SENDER' && invitation.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this invitation' });
    }
    
    await prisma.invitation.delete({
      where: { id }
    });
    
    res.json({ message: 'Invitation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invitation', error: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const where = {};
    const recipientWhere = {};
    
    if (req.user.role === 'SENDER') {
      where.creatorId = req.user.id;
      recipientWhere.senderId = req.user.id;
    }
    
    const totalInvitations = await prisma.invitation.count({ where });
    const totalRecipients = await prisma.recipient.count({ where: recipientWhere });
    const sent = await prisma.recipient.count({ where: { ...recipientWhere, responseStatus: { not: 'NOT_SENT' } } });
    const notViewed = await prisma.recipient.count({ where: { ...recipientWhere, responseStatus: { in: ['NOT_SENT', 'SENT', 'DELIVERED'] } } });
    const viewed = await prisma.recipient.count({ where: { ...recipientWhere, responseStatus: { notIn: ['NOT_SENT', 'SENT', 'DELIVERED'] } } });
    const accepted = await prisma.recipient.count({ where: { ...recipientWhere, responseStatus: 'ACCEPTED' } });
    const maybe = await prisma.recipient.count({ where: { ...recipientWhere, responseStatus: 'MAYBE' } });
    const declined = await prisma.recipient.count({ where: { ...recipientWhere, responseStatus: 'DECLINED' } });
    const checkedIn = await prisma.recipient.count({ where: { ...recipientWhere, checkIn: { isNot: null } } });

    res.json({
      totalInvitations,
      totalRecipients,
      sent,
      notViewed,
      viewed,
      accepted,
      maybe,
      declined,
      checkedIn
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

module.exports = {
  getInvitations,
  getInvitation,
  createInvitation,
  updateInvitation,
  deleteInvitation,
  getDashboardStats
};
