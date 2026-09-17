const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  async init() {
    // For development, use Ethereal Email (fake SMTP service)
    try {
      let testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, 
        auth: {
          user: testAccount.user, 
          pass: testAccount.pass, 
        },
      });
      console.log(`[Email Service] Initialized Ethereal test account: ${testAccount.user}`);
    } catch (err) {
      console.error('[Email Service] Failed to initialize Ethereal account:', err);
    }
  }

  async sendInvitationEmail(recipient, invitationLink) {
    if (!this.transporter) {
      console.error('[Email Service] Transporter not ready yet.');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: '"Invitation System" <invitations@example.com>',
        to: recipient.email,
        subject: "You're Invited!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
            <h1 style="color: #333;">You're Invited!</h1>
            <p style="font-size: 16px; color: #555;">Hi ${recipient.name},</p>
            <p style="font-size: 16px; color: #555;">You have received an exclusive invitation.</p>
            <div style="margin: 30px 0;">
              <a href="${invitationLink}" style="background-color: #E63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Your Invitation</a>
            </div>
          </div>
        `,
      });

      console.log(`[Email Service] Preview URL: %s`, nodemailer.getTestMessageUrl(info));
      
      return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
    } catch (error) {
      console.error(`[Email Service] Error sending email to ${recipient.email}:`, error);
      return { success: false, error };
    }
  }
}

module.exports = new EmailService();
