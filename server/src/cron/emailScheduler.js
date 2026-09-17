const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

class EmailScheduler {
  init() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
      console.log('[Email Scheduler] Checking for scheduled emails...');
      try {
        const now = new Date();
        
        // Find recipients whose sendDate is in the past and are NOT_SENT
        const recipients = await prisma.recipient.findMany({
          where: {
            sendDate: {
              lte: now,
            },
            responseStatus: 'NOT_SENT',
            email: {
              not: null,
            },
          },
        });

        if (recipients.length === 0) {
          return;
        }

        console.log(`[Email Scheduler] Found ${recipients.length} emails to send.`);

        for (const recipient of recipients) {
          // Generate the unique link
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const invitationLink = `${frontendUrl}/invitation/${recipient.token}`;

          const result = await emailService.sendInvitationEmail(recipient, invitationLink);

          if (result.success) {
            // Update status to SENT
            await prisma.recipient.update({
              where: { id: recipient.id },
              data: { 
                responseStatus: 'SENT',
                sentDate: new Date()
              }
            });
          }
        }
      } catch (error) {
        console.error('[Email Scheduler] Error processing scheduled emails:', error);
      }
    });

    console.log('[Email Scheduler] Cron job initialized.');
  }
}

module.exports = new EmailScheduler();
