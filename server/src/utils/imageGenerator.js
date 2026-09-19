const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Candidate upload directories for persistence across restarts
const getUploadCandidates = () => {
  const envCustom = process.env.PERSISTENT_UPLOADS_DIR;
  const candidates = [
    ...(envCustom ? [envCustom] : []),
    path.join(__dirname, '../../../uploads'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'server/uploads'),
    path.join(__dirname, '../../../client/dist/uploads'),
    path.join(os.tmpdir(), 'uploads')
  ];
  return candidates;
};

// Locate an existing template file across candidate directories
const resolveTemplateFile = (relOrAbsPath) => {
  if (!relOrAbsPath) return null;
  if (path.isAbsolute(relOrAbsPath) && fs.existsSync(relOrAbsPath)) {
    return relOrAbsPath;
  }
  
  const relPath = relOrAbsPath.replace(/^\//, '');
  const candidateBaseDirs = [
    path.join(__dirname, '../../../'),
    process.cwd(),
    path.join(process.cwd(), 'server'),
    path.join(__dirname, '../../../client/dist'),
    os.tmpdir()
  ];

  for (const baseDir of candidateBaseDirs) {
    const fullPath = path.join(baseDir, relPath);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
};

// Query active template dynamically from DB
const resolveTemplateAndConfig = async (templateId) => {
  let template = null;
  let isFallback = false;

  if (templateId) {
    template = await prisma.template.findUnique({
      where: { id: parseInt(templateId, 10) },
      include: { defaultConfig: true }
    });
  }

  if (!template || !template.isActive || template.isArchived) {
    // Dynamic query for current active template in database
    template = await prisma.template.findFirst({
      where: { isActive: true, isArchived: false },
      include: { defaultConfig: true },
      orderBy: { id: 'asc' }
    });
    if (templateId && template && template.id !== parseInt(templateId, 10)) {
      isFallback = true;
    }
  }

  if (!template) {
    throw new Error('No active template found in database.');
  }

  let templateFilePath = resolveTemplateFile(template.originalFilePath);
  
  // If original file is PDF or missing, check PNG version
  if (!templateFilePath || templateFilePath.endsWith('.pdf')) {
    const pngRelPath = (template.originalFilePath || '').replace(/\.pdf$/, '.png');
    const pngPath = resolveTemplateFile(pngRelPath);
    if (pngPath) {
      templateFilePath = pngPath;
    }
  }

  if (!templateFilePath) {
    // Fallback search for default bni-template.png
    templateFilePath = resolveTemplateFile('/uploads/templates/bni-template.png');
  }

  if (!templateFilePath || !fs.existsSync(templateFilePath)) {
    throw new Error(`Template image file not found for template ID ${template.id}`);
  }

  const config = template.defaultConfig && template.defaultConfig[0] 
    ? template.defaultConfig[0] 
    : {
        xPosition: 0.1,
        yPosition: 0.565,
        textBoxWidth: 0.8,
        fontFamily: '"Clicker Script", cursive, Georgia, serif',
        fontSize: 20,
        fontWeight: 'normal',
        fontColour: '#000000',
        textAlignment: 'center'
      };

  return {
    template,
    templateFilePath,
    config,
    isFallback
  };
};

const escapeXml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Generate Full-HD invitation portrait image and 1200x630 Open Graph preview
 */
const generateInvitationAssets = async ({
  recipientName,
  templateId = null,
  designConfiguration = null,
  token = null,
  recipientId = null
}) => {
  const { template, templateFilePath, config, isFallback } = await resolveTemplateAndConfig(templateId);

  // Parse design configuration override if provided
  let effectiveConfig = { ...config };
  if (designConfiguration) {
    try {
      const parsed = typeof designConfiguration === 'string' ? JSON.parse(designConfiguration) : designConfiguration;
      effectiveConfig = { ...effectiveConfig, ...parsed };
    } catch (e) {
      // keep defaultConfig
    }
  }

  const templateMeta = await sharp(templateFilePath).metadata();
  let canvasWidth = templateMeta.width || 1080;
  let canvasHeight = templateMeta.height || 1920;

  // Enforce minimum Full-HD resolution (1080x1920)
  if (canvasWidth < 1080 || canvasHeight < 1920) {
    if (canvasHeight >= canvasWidth) {
      canvasWidth = Math.max(1080, canvasWidth);
      canvasHeight = Math.max(1920, Math.round(canvasWidth * 1.7778));
    } else {
      canvasWidth = Math.max(1920, canvasWidth);
      canvasHeight = Math.max(1080, Math.round(canvasWidth / 1.7778));
    }
  }

  // Compute text rendering parameters
  const xPercent = effectiveConfig.xPosition ?? 0.1;
  const yPercent = effectiveConfig.yPosition ?? 0.565;
  const boxWidthPercent = effectiveConfig.textBoxWidth ?? 0.8;

  const fontScaleFactor = canvasWidth / 600;
  const fontSizePx = Math.round((effectiveConfig.fontSize || 20) * fontScaleFactor);

  const fontFamily = effectiveConfig.fontFamily || '"Clicker Script", cursive, Georgia, serif';
  const fontWeight = effectiveConfig.fontWeight === 'bold' ? 'bold' : 'normal';
  const fontColour = effectiveConfig.fontColour || '#000000';
  const textAlignment = effectiveConfig.textAlignment || effectiveConfig.textAlign || 'center';

  let textAnchor = 'middle';
  let drawX = Math.round(canvasWidth / 2);
  const startY = Math.round(yPercent * canvasHeight);

  if (textAlignment === 'left') {
    textAnchor = 'start';
    drawX = Math.round(xPercent * canvasWidth);
  } else if (textAlignment === 'right') {
    textAnchor = 'end';
    drawX = Math.round((xPercent + boxWidthPercent) * canvasWidth);
  }

  const safeName = escapeXml(recipientName || '');

  // SVG text overlay layer
  const svgOverlay = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .receiver-name {
          font-family: ${fontFamily};
          font-size: ${fontSizePx}px;
          font-weight: ${fontWeight};
          fill: ${fontColour};
          text-anchor: ${textAnchor};
          dominant-baseline: middle;
        }
      </style>
      <text x="${drawX}" y="${startY}" class="receiver-name">${safeName}</text>
    </svg>
  `;

  // Render Full-HD portrait invitation PNG buffer
  const portraitBuffer = await sharp(templateFilePath)
    .resize(canvasWidth, canvasHeight, { fit: 'fill' })
    .composite([{ input: Buffer.from(svgOverlay) }])
    .png({ quality: 100, compressionLevel: 6 })
    .toBuffer();

  // Render 1200x630 Open Graph JPEG preview buffer
  const portraitResizedForOg = await sharp(portraitBuffer)
    .resize({ height: 550, fit: 'inside' })
    .toBuffer();

  const ogBuffer = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: { r: 248, g: 250, b: 252 }
    }
  })
  .composite([{ input: portraitResizedForOg, gravity: 'center' }])
  .jpeg({ quality: 90 })
  .toBuffer();

  // Generate persistent filenames
  const fileIdentifier = token || recipientId || require('crypto').randomBytes(16).toString('hex');
  const mainFileName = `invite-${fileIdentifier}.png`;
  const ogFileName = `invite-${token || fileIdentifier}.jpg`;

  const candidates = getUploadCandidates();
  let savedRelativePath = `/uploads/generated/${mainFileName}`;

  // Write files to candidate upload directories to ensure durability across restarts
  for (const baseDir of candidates) {
    try {
      const genDir = path.join(baseDir, 'generated');
      const socialDir = path.join(baseDir, 'social');

      if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
      if (!fs.existsSync(socialDir)) fs.mkdirSync(socialDir, { recursive: true });

      fs.writeFileSync(path.join(genDir, mainFileName), portraitBuffer);
      fs.writeFileSync(path.join(socialDir, ogFileName), ogBuffer);

      if (recipientId) {
        fs.writeFileSync(path.join(genDir, `og-invite-${recipientId}.jpg`), ogBuffer);
      }
    } catch (err) {
      console.warn(`[WARN] Could not write asset to ${baseDir}:`, err.message);
    }
  }

  return {
    generatedPdfPath: savedRelativePath,
    ogImagePath: `/uploads/social/${ogFileName}`,
    canvasWidth,
    canvasHeight,
    ogWidth: 1200,
    ogHeight: 630,
    ogSize: ogBuffer.length,
    portraitSize: portraitBuffer.length,
    templateUsedId: template.id,
    templateName: template.name,
    isFallback
  };
};

module.exports = {
  generateInvitationAssets,
  resolveTemplateAndConfig
};
