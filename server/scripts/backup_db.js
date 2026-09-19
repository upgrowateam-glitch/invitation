const path = require('path');
const fs = require('fs');
const { PrismaClient } = require(path.join(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function backupDatabase() {
  console.log('[BACKUP] Starting database snapshot backup...');
  
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `db_backup_${timestamp}.json`);

  try {
    const users = await prisma.user.findMany();
    const invitations = await prisma.invitation.findMany();
    const templates = await prisma.template.findMany({ include: { defaultConfig: true } });
    const configs = await prisma.templateDefaultConfiguration.findMany();
    const designs = await prisma.invitationDesign.findMany();
    const recipients = await prisma.recipient.findMany({ include: { design: true } });
    const pdfs = await prisma.generatedInvitationPdf.findMany();
    const activities = await prisma.invitationActivity.findMany();
    const checkIns = await prisma.checkIn.findMany();

    const snapshot = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalRecipients: recipients.length,
        totalTemplates: templates.length,
        totalInvitations: invitations.length
      },
      data: {
        users,
        invitations,
        templates,
        templateDefaultConfigurations: configs,
        invitationDesigns: designs,
        recipients,
        generatedInvitationPdfs: pdfs,
        invitationActivities: activities,
        checkIns
      }
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`[BACKUP SUCCESS] Backup saved safely to: ${backupFilePath}`);
    console.log(`[BACKUP SUCCESS] Total records saved: ${recipients.length} recipients, ${templates.length} templates, ${invitations.length} invitations.`);
    return backupFilePath;
  } catch (err) {
    console.error('[BACKUP ERROR] Failed to create database snapshot:', err.message);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  backupDatabase();
}

module.exports = { backupDatabase };
