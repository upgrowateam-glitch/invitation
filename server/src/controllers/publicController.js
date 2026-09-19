const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateInvitationAssets } = require('../utils/imageGenerator');

// In-memory mutex map to prevent simultaneous duplicate regeneration requests for the same token
const activeRegenerations = new Map();

const findAssetOnDisk = (relPath) => {
  if (!relPath || relPath.startsWith('data:')) return null;
  const cleanRel = relPath.replace(/^\//, '');
  const candidateDirs = [
    path.join(__dirname, '../../../uploads'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'server/uploads'),
    path.join(__dirname, '../../../client/dist/uploads'),
    path.join(os.tmpdir(), 'uploads')
  ];

  for (const baseDir of candidateDirs) {
    const fullPath = path.join(baseDir, '..', cleanRel);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 100) {
      return fullPath;
    }
  }
  return null;
};

// Check if request originates from a social media crawler/bot
const isCrawlerRequest = (req) => {
  const ua = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|whatsapp|twitterbot|slackbot|linkedinbot|embedly|quora|googlebot|bingbot|crawler|spider/i.test(ua);
  return isBot || req.query.crawler === 'true';
};

// Safe server-side dynamic regeneration fallback
const ensureRecipientAsset = async (recipient) => {
  let existingFile = findAssetOnDisk(recipient.generatedPdfPath);
  if (existingFile) return recipient.generatedPdfPath;

  const token = recipient.token;
  if (activeRegenerations.has(token)) {
    await activeRegenerations.get(token);
    const updated = await prisma.recipient.findUnique({ where: { token } });
    return updated ? updated.generatedPdfPath : recipient.generatedPdfPath;
  }

  const regenerationPromise = (async () => {
    try {
      console.log(`[SERVER RECOVERY] Image missing for recipient ${recipient.id} (${recipient.name}). Regenerating on-the-fly...`);
      const designConfig = recipient.design ? recipient.design.designConfiguration : null;

      const assets = await generateInvitationAssets({
        recipientName: recipient.name,
        templateId: recipient.templateId,
        designConfiguration: designConfig,
        token: recipient.token,
        recipientId: recipient.id
      });

      // Update only path and templateId in MySQL, preserving tracking and RSVP data
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          generatedPdfPath: assets.generatedPdfPath,
          templateId: assets.templateUsedId
        }
      });

      return assets.generatedPdfPath;
    } catch (err) {
      console.error(`[SERVER RECOVERY ERROR] Failed to dynamically regenerate asset for ${recipient.id}:`, err.message);
      return recipient.generatedPdfPath;
    } finally {
      activeRegenerations.delete(token);
    }
  })();

  activeRegenerations.set(token, regenerationPromise);
  return await regenerationPromise;
};

const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const recipient = await prisma.recipient.findUnique({
      where: { token },
      include: {
        design: true,
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

    // Ensure main invitation asset exists; recover on-the-fly if missing
    const validPdfPath = await ensureRecipientAsset(recipient);

    // Update view status ONLY for genuine human users (DO NOT update for crawlers or repair checks)
    const isBot = isCrawlerRequest(req);
    if (!isBot) {
      if (['NOT_SENT', 'SENT', 'DELIVERED'].includes(recipient.responseStatus)) {
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
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
          }
        });
      } else {
        await prisma.recipient.update({
          where: { id: recipient.id },
          data: { lastViewedDate: new Date() }
        });
      }
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
        generatedPdfPath: validPdfPath,
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
        description: 'You are cordially invited to join us.',
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
    console.error('getInvitationByToken error:', error);
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
        metadata: JSON.stringify({ guests, notes }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
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

// Protected high-availability download safety endpoint
const downloadInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const recipient = await prisma.recipient.findUnique({
      where: { token },
      include: { design: true }
    });

    if (!recipient) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Ensure asset is generated and available
    const assetPath = await ensureRecipientAsset(recipient);
    const diskPath = findAssetOnDisk(assetPath);

    if (!diskPath) {
      return res.status(422).json({ message: 'Invitation image generation pending or unavailable.' });
    }

    const ext = path.extname(diskPath).toLowerCase();
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : (ext === '.pdf' ? 'application/pdf' : 'image/png');
    const safeFilename = `invitation-${(recipient.name || 'guest').replace(/\s+/g, '_')}${ext}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.sendFile(diskPath);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ message: 'Download failed', error: err.message });
  }
};

module.exports = {
  getInvitationByToken,
  submitRsvp,
  downloadInvitation
};
