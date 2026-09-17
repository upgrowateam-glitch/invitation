const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const recipient = await prisma.recipient.findUnique({
      where: { token },
      include: {
        invitation: {
          include: { creator: { select: { name: true } } }
        }
      }
    });

    if (!recipient) {
      return res.status(404).json({ message: 'Invalid or expired invitation link' });
    }

    if (recipient.invitation && recipient.invitation.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'This invitation is not currently active' });
    }

    // Expiration logic based on receiveDate
    if (recipient.receiveDate) {
      const now = new Date();
      if (now > new Date(recipient.receiveDate)) {
        return res.status(403).json({ message: 'This invitation has expired.' });
      }
    }

    // Update view status
    if (recipient.responseStatus === 'NOT_SENT' || recipient.responseStatus === 'SENT' || recipient.responseStatus === 'DELIVERED') {
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: { 
          responseStatus: 'VIEWED', 
          firstViewedDate: new Date(),
          lastViewedDate: new Date()
        }
      });
      
      // Log activity
      await prisma.invitationActivity.create({
        data: {
          recipientId: recipient.id,
          action: 'VIEWED',
        }
      });
    } else {
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: { lastViewedDate: new Date() }
      });
    }

    res.json({
      recipient: {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        responseStatus: recipient.responseStatus,
        attendingGuests: recipient.attendingGuests,
        notes: recipient.notes,
        maxAllowedGuests: recipient.maxAllowedGuests,
        generatedPdfPath: recipient.generatedPdfPath,
      },
      invitation: recipient.invitation ? {
        title: recipient.invitation.title,
        description: recipient.invitation.description,
        eventDate: recipient.invitation.eventDate,
        startTime: recipient.invitation.startTime,
        endTime: recipient.invitation.endTime,
        venueName: recipient.invitation.venueName,
        address: recipient.invitation.address,
        googleMapsLink: recipient.invitation.googleMapsLink,
        hostName: recipient.invitation.hostName,
        allowGuests: recipient.invitation.allowGuests,
      } : {
        title: 'Special Event',
        description: 'You are invited!',
        eventDate: new Date(),
        startTime: '10:00 AM',
        venueName: 'TBA',
        address: 'TBA',
        hostName: recipient.senderName || 'Sender',
        allowGuests: false
      },
      templateId: recipient.templateId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const submitRsvp = async (req, res) => {
  try {
    const { token } = req.params;
    const { status, guests, notes } = req.body;

    const recipient = await prisma.recipient.findUnique({
      where: { token },
      include: { invitation: true }
    });

    if (!recipient) {
      return res.status(404).json({ message: 'Invalid token' });
    }

    if (['ACCEPTED', 'DECLINED', 'MAYBE'].includes(recipient.responseStatus)) {
      return res.status(400).json({ message: 'Response already submitted.' });
    }

    const updatedRecipient = await prisma.recipient.update({
      where: { id: recipient.id },
      data: {
        responseStatus: status,
        attendingGuests: guests || 0,
        notes,
        responseDate: new Date(),
      }
    });

    await prisma.invitationActivity.create({
      data: {
        recipientId: recipient.id,
        action: `RSVP_${status}`,
        metadata: JSON.stringify({ guests, notes })
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('rsvp_update', updatedRecipient);
    }

    res.json({ message: 'RSVP submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getInvitationByToken, submitRsvp };
