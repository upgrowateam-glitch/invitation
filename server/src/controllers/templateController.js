const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const crypto = require('crypto');

const getTemplates = async (req, res) => {
  try {
    let templates = await prisma.template.findMany({
      where: { isArchived: false },
      include: { defaultConfig: true },
      orderBy: { createdAt: 'desc' }
    });

    // Ensure any template missing a defaultConfig gets one auto-created in MySQL
    for (const t of templates) {
      if (!t.defaultConfig || t.defaultConfig.length === 0) {
        try {
          const newCfg = await prisma.templateDefaultConfiguration.create({
            data: {
              templateId: t.id,
              pageNumber: 1,
              xPosition: 0.1,
              yPosition: 0.565,
              textBoxWidth: 0.8,
              fontFamily: 'Clicker Script',
              fontSize: 20,
              textAlignment: 'center',
              fontColour: '#000000',
              fontWeight: 'normal'
            }
          });
          t.defaultConfig = [newCfg];
        } catch (cfgErr) {
          console.error(`Error auto-generating defaultConfig for template ${t.id}:`, cfgErr);
        }
      }
    }

    res.json(templates);
  } catch (error) {
    console.error('getTemplates Error:', error);
    res.status(500).json({ message: 'Error fetching templates', error: error.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    const { name, description, category } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }
    
    let fileType = 'PDF';
    if (req.file.mimetype === 'image/jpeg') fileType = 'JPG';
    if (req.file.mimetype === 'image/png') fileType = 'PNG';
    
    const template = await prisma.template.create({
      data: {
        name,
        description: description || null,
        category: category || 'General Invitation',
        sourceType: 'UPLOAD',
        fileType,
        originalFilePath: `/uploads/templates/${req.file.filename}`,
        thumbnailPath: `/uploads/templates/${req.file.filename}`,
        createdBy: req.user ? req.user.id : null,
        defaultConfig: {
          create: {
            pageNumber: 1,
            xPosition: 0.1,
            yPosition: 0.565,
            textBoxWidth: 0.8,
            fontFamily: 'Clicker Script',
            fontSize: 20,
            textAlignment: 'center',
            fontColour: '#000000',
            fontWeight: 'normal'
          }
        }
      },
      include: { defaultConfig: true }
    });
    res.status(201).json(template);
  } catch (error) {
    console.error('createTemplate Error:', error);
    res.status(500).json({ message: 'Error creating template', error: error.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, isArchived, category } = req.body;
    
    const template = await prisma.template.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(isArchived !== undefined && { isArchived }),
      }
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error updating template' });
  }
};

const saveTemplateFields = async (req, res) => {
  try {
    const { id } = req.params;
    const { fields } = req.body; // Expects an array or single config

    const configToSave = Array.isArray(fields) ? fields[0] : fields;

    // Delete existing config
    await prisma.templateDefaultConfiguration.deleteMany({
      where: { templateId: parseInt(id) },
    });

    if (configToSave) {
      const newConfig = await prisma.templateDefaultConfiguration.create({
        data: {
          templateId: parseInt(id),
          pageNumber: configToSave.pageNumber || 1,
          xPosition: configToSave.xPosition,
          yPosition: configToSave.yPosition,
          textBoxWidth: configToSave.textBoxWidth || null,
          textBoxHeight: configToSave.textBoxHeight || null,
          fontFamily: configToSave.fontFamily || 'Clicker Script',
          fontSize: configToSave.fontSize || 20,
          textAlignment: configToSave.textAlignment || configToSave.textAlign || 'center',
          fontColour: configToSave.fontColour || '#000000',
          fontWeight: configToSave.fontWeight || 'normal'
        },
      });
      return res.json([newConfig]);
    }
    res.json([]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving configuration' });
  }
};

// Core PDF Generation Engine (Used by preview and final generation)
const generatePdfDocument = async (template, recipientName, designConfigOverride = null) => {
  let pdfDoc;
  let page;
  
  const absolutePath = path.join(__dirname, '../../..', template.originalFilePath);
  const fileBytes = fs.readFileSync(absolutePath);

  if (template.fileType === 'PDF') {
    pdfDoc = await PDFDocument.load(fileBytes);
    page = pdfDoc.getPages()[0]; // Default to first page
  } else {
    // If it's an image, create a new PDF and embed the image
    pdfDoc = await PDFDocument.create();
    let image;
    if (template.fileType === 'JPG') {
      image = await pdfDoc.embedJpg(fileBytes);
    } else {
      image = await pdfDoc.embedPng(fileBytes);
    }
    page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Determine which config to use (override from InvitationDesign or default)
  const config = designConfigOverride || (template.defaultConfig && template.defaultConfig[0]);

  if (config) {
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    const text = recipientName || 'Test Name';
    const fontToUse = config.fontWeight === 'bold' ? helveticaBold : helveticaFont;
    
    let currentFontSize = config.fontSize;
    const minFontSize = 10;
    
    // Box coords (x,y are normalized 0-1 from top-left)
    const startX = config.xPosition * pageWidth;
    let startY = pageHeight - (config.yPosition * pageHeight); // PDF lib origin is bottom-left
    
    // Auto-scaling logic
    if (config.textBoxWidth) {
      const maxWidthPx = config.textBoxWidth * pageWidth;
      let textWidth = fontToUse.widthOfTextAtSize(text, currentFontSize);
      
      while (textWidth > maxWidthPx && currentFontSize > minFontSize) {
        currentFontSize -= 1;
        textWidth = fontToUse.widthOfTextAtSize(text, currentFontSize);
      }
    }

    // Convert hex color to rgb
    const hex = (config.fontColour || '#000000').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
    const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
    const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;

    // Text Alignment adjustment
    let drawX = startX;
    const alignment = config.textAlignment || config.textAlign || 'left';
    
    if (config.textBoxWidth) {
      const textWidth = fontToUse.widthOfTextAtSize(text, currentFontSize);
      const boxWidth = config.textBoxWidth * pageWidth;
      
      if (alignment === 'center') {
        drawX = startX + (boxWidth / 2) - (textWidth / 2);
      } else if (alignment === 'right') {
        drawX = startX + boxWidth - textWidth;
      }
    }

    // Adjust Y for baseline
    const fontHeight = fontToUse.heightAtSize(currentFontSize);
    const drawY = startY - fontHeight * 0.8; 

    page.drawText(text, {
      x: drawX,
      y: drawY,
      size: currentFontSize,
      font: fontToUse,
      color: rgb(r, g, b),
    });
  }

  return await pdfDoc.save();
};

const generatePreview = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientName, designConfiguration } = req.body;

    const template = await prisma.template.findUnique({
      where: { id: parseInt(id) },
      include: { defaultConfig: true },
    });

    if (!template) return res.status(404).json({ message: 'Template not found' });

    let parsedConfig = null;
    if (designConfiguration) {
      try {
        parsedConfig = typeof designConfiguration === 'string' ? JSON.parse(designConfiguration) : designConfiguration;
      } catch (e) {
        console.error('Invalid design config JSON');
      }
    }

    const modifiedPdfBytes = await generatePdfDocument(template, recipientName, parsedConfig);
    
    const uploadsDir = path.join(__dirname, '../../../uploads/generated');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    
    const fileName = `preview-${crypto.randomBytes(4).toString('hex')}.pdf`;
    const tempPath = path.join(uploadsDir, fileName);
    fs.writeFileSync(tempPath, modifiedPdfBytes);
    
    res.json({ url: `/uploads/generated/${fileName}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating preview' });
  }
};

// Exported for internal use by recipientController
const generateFinalPdf = async (templateId, recipientName, designConfiguration = null) => {
  const template = await prisma.template.findUnique({
    where: { id: parseInt(templateId) },
    include: { defaultConfig: true },
  });
  
  if (!template) throw new Error('Template not found');
  
  let parsedConfig = null;
  if (designConfiguration) {
    parsedConfig = typeof designConfiguration === 'string' ? JSON.parse(designConfiguration) : designConfiguration;
  }

  const modifiedPdfBytes = await generatePdfDocument(template, recipientName, parsedConfig);
  
  const uploadsDir = path.join(__dirname, '../../../uploads/generated');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  
  const fileName = `invite-${crypto.randomBytes(16).toString('hex')}.pdf`;
  const finalPath = path.join(uploadsDir, fileName);
  fs.writeFileSync(finalPath, modifiedPdfBytes);
  
  return `/uploads/generated/${fileName}`;
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  saveTemplateFields,
  generatePreview,
  generateFinalPdf,
};
