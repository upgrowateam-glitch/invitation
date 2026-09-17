const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const { generateFinalPdf } = require('./templateController');
const excelJS = require('exceljs');
const { Readable } = require('stream');

// Get all recipients for the logged-in sender
// Can filter by invitationId if provided
const getRecipients = async (req, res) => {
  try {
    const { invitationId } = req.query;
    const where = { senderId: req.user.id };
    
    if (invitationId) {
      where.invitationId = parseInt(invitationId, 10);
    }
    
    const recipients = await prisma.recipient.findMany({
      where,
      include: {
        invitation: { select: { title: true, eventDate: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(recipients);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recipients', error: error.message });
  }
};

// Get a single recipient by ID
const getRecipientById = async (req, res) => {
  try {
    const recipient = await prisma.recipient.findFirst({
      where: { 
        id: parseInt(req.params.id, 10),
        senderId: req.user.id
      },
      include: {
        invitation: true
      }
    });
    
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    res.json(recipient);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recipient', error: error.message });
  }
};

// Create a new recipient
const createRecipient = async (req, res) => {
  try {
    const { name, email, phone, company, invitationId, senderName, templateId, designConfiguration, maxAllowedGuests, notes, responseStatus, sentDate, sendDate, receiveDate } = req.body;
    
    let currentSenderId = req.user?.id;
    if (!currentSenderId) {
      const firstUser = await prisma.user.findFirst({ where: { isActive: true } });
      if (firstUser) currentSenderId = firstUser.id;
    }

    // Duplicate Check: Same senderName, name, and templateId (to prevent accidental double clicks)
    const existing = await prisma.recipient.findFirst({
      where: {
        senderId: currentSenderId || undefined,
        name: name,
        senderName: senderName || null,
        templateId: templateId ? parseInt(templateId, 10) : undefined
      }
    });

    if (existing && !req.body.forceCreate) {
      return res.status(409).json({ 
        message: 'A similar invitation has already been sent to this receiver by this sender.',
        existingId: existing.id
      }); 
    }

    // Generating secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Auto-generate the personalized PDF immediately and securely save it
    let generatedPdfPath = null;
    if (req.body.base64Image) {
      const match = req.body.base64Image.match(/^data:image\/(\w+);base64,/);
      const ext = match && match[1] === 'jpeg' ? 'jpg' : 'png';
      const base64Data = req.body.base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const fileId = crypto.randomBytes(16).toString('hex');
      const fileName = `invite-${fileId}.${ext}`;
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const primaryDir = path.join(__dirname, '../../../uploads/generated');
      const tmpDir = path.join(os.tmpdir(), 'uploads/generated');
      
      let savedToFile = false;
      for (const targetDir of [primaryDir, tmpDir]) {
        try {
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, fileName), buffer);

          if (req.body.ogBase64Image) {
            const ogMatch = req.body.ogBase64Image.match(/^data:image\/(\w+);base64,/);
            const ogExt = ogMatch && ogMatch[1] === 'jpeg' ? 'jpg' : 'png';
            const ogBase64Data = req.body.ogBase64Image.replace(/^data:image\/\w+;base64,/, '');
            const ogBuffer = Buffer.from(ogBase64Data, 'base64');
            const ogFileName = `og-invite-${fileId}.${ogExt}`;
            fs.writeFileSync(path.join(targetDir, ogFileName), ogBuffer);
          }
          
          generatedPdfPath = `/uploads/generated/${fileName}`;
          savedToFile = true;
          break;
        } catch (err) {
          console.warn(`Could not save image to ${targetDir}:`, err.message);
        }
      }

      if (!savedToFile) {
        generatedPdfPath = req.body.base64Image;
      }
    } else if (templateId) {
      try {
        const { generateFinalPdf } = require('./templateController');
        generatedPdfPath = await generateFinalPdf(templateId, name, designConfiguration);
      } catch (err) {
        console.warn('Error generating final PDF fallback:', err.message);
      }
    }

    // Check if template exists for relational design create
    let parsedTemplateId = templateId ? parseInt(templateId, 10) : null;
    let templateExists = false;
    if (parsedTemplateId) {
      const foundTemplate = await prisma.template.findUnique({ where: { id: parsedTemplateId } });
      if (foundTemplate) templateExists = true;
    }

    const recipient = await prisma.recipient.create({
      data: {
        name,
        email,
        phone,
        company,
        invitationId: invitationId ? parseInt(invitationId, 10) : null,
        senderId: currentSenderId || null,
        senderName,
        templateId: templateExists ? parsedTemplateId : null,
        generatedPdfPath,
        token,
        maxAllowedGuests: maxAllowedGuests || 0,
        notes,
        responseStatus: responseStatus || 'SENT',
        sentDate: sentDate ? new Date(sentDate) : new Date(),
        sendDate: sendDate ? new Date(sendDate) : (email ? new Date() : null),
        receiveDate: receiveDate ? new Date(receiveDate) : null,
        design: (designConfiguration && templateExists) ? {
          create: {
            templateId: parsedTemplateId,
            receiverName: name,
            designConfiguration: typeof designConfiguration === 'string' ? designConfiguration : JSON.stringify(designConfiguration)
          }
        } : undefined
      },
      include: {
        design: true
      }
    });
    
    res.status(201).json(recipient);
  } catch (error) {
    console.error('Error in createRecipient:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Recipient with this email or phone already exists for this invitation.' });
    }
    res.status(500).json({ message: 'Error creating recipient', error: error.message });
  }
};

// Update a recipient
const updateRecipient = async (req, res) => {
  try {
    const { name, email, phone, company, maxAllowedGuests, notes } = req.body;
    
    // Check ownership first
    const existing = await prisma.recipient.findFirst({
      where: { 
        id: parseInt(req.params.id, 10),
        senderId: req.user.id 
      }
    });
    
    if (!existing) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    const recipient = await prisma.recipient.update({
      where: { id: parseInt(req.params.id, 10) },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        maxAllowedGuests: maxAllowedGuests !== undefined ? parseInt(maxAllowedGuests, 10) : existing.maxAllowedGuests,
        notes: notes || null
      }
    });
    
    res.json(recipient);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Recipient with this email or phone already exists for this invitation.' });
    }
    res.status(500).json({ message: 'Error updating recipient', error: error.message });
  }
};

// Delete a recipient
const deleteRecipient = async (req, res) => {
  try {
    // Check ownership
    const existing = await prisma.recipient.findFirst({
      where: { 
        id: parseInt(req.params.id, 10),
        senderId: req.user.id 
      }
    });
    
    if (!existing) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    await prisma.recipient.delete({
      where: { id: parseInt(req.params.id, 10) }
    });
    
    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting recipient', error: error.message });
  }
};

// Import recipients from Excel/CSV
const importRecipients = async (req, res) => {
  try {
    const { invitationId } = req.body;
    
    if (!invitationId) {
      return res.status(400).json({ message: 'invitationId is required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const workbook = new excelJS.Workbook();
    
    if (req.file.originalname.toLowerCase().endsWith('.csv')) {
      const stream = Readable.from(req.file.buffer);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }
    
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ message: 'Could not read worksheet' });
    }
    
    const recipientsToCreate = [];
    
    worksheet.eachRow((row, rowNumber) => {
      // Assuming row 1 is header: Name, Email, Phone, Company, MaxGuests, Notes
      if (rowNumber === 1) return;
      
      const name = row.getCell(1).value?.toString().trim();
      if (!name) return; // Skip if no name
      
      const token = crypto.randomBytes(32).toString('hex');
      const maxGuestsVal = row.getCell(5).value;
      
      recipientsToCreate.push({
        name,
        email: row.getCell(2).value?.toString().trim() || null,
        phone: row.getCell(3).value?.toString().trim() || null,
        company: row.getCell(4).value?.toString().trim() || null,
        maxAllowedGuests: maxGuestsVal ? parseInt(maxGuestsVal, 10) : 0,
        notes: row.getCell(6).value?.toString().trim() || null,
        invitationId: parseInt(invitationId, 10),
        senderId: req.user.id,
        token
      });
    });
    
    if (recipientsToCreate.length === 0) {
      return res.status(400).json({ message: 'No valid recipients found in the file' });
    }
    
    const result = await prisma.recipient.createMany({
      data: recipientsToCreate,
      skipDuplicates: true // Skip if email/phone already exists for this invitation
    });
    
    res.status(201).json({ 
      message: `Successfully imported ${result.count} recipients`,
      count: result.count 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error importing recipients', error: error.message });
  }
};

module.exports = {
  getRecipients,
  getRecipientById,
  createRecipient,
  updateRecipient,
  deleteRecipient,
  importRecipients
};
