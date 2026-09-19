const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Startup validation: Locate and register bundled ClickerScript-Regular.ttf font
const fontPath = [
  path.join(__dirname, '../../assets/fonts/ClickerScript-Regular.ttf'),
  path.join(process.cwd(), 'assets/fonts/ClickerScript-Regular.ttf'),
  path.join(process.cwd(), 'server/assets/fonts/ClickerScript-Regular.ttf'),
  path.join(__dirname, '../../..', 'client/src/assets/fonts/ClickerScript-Regular.ttf')
].find(p => fs.existsSync(p));

if (!fontPath) {
  throw new Error('[FATAL ERROR] ClickerScript-Regular.ttf font file not found! Server cannot generate invitations without bundled font.');
}

const fontRegistered = GlobalFonts.registerFromPath(fontPath, 'Clicker Script');
if (!fontRegistered) {
  throw new Error(`[FATAL ERROR] Failed to register bundled font from ${fontPath}`);
}
console.log(`[FONT LOADED SUCCESS] Clicker Script registered from: ${fontPath}`);

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
  
  if (!templateFilePath || templateFilePath.endsWith('.pdf')) {
    const pngRelPath = (template.originalFilePath || '').replace(/\.pdf$/, '.png');
    const pngPath = resolveTemplateFile(pngRelPath);
    if (pngPath) {
      templateFilePath = pngPath;
    }
  }

  if (!templateFilePath) {
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
        fontFamily: 'Clicker Script',
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

/**
 * Generate Full-HD invitation portrait image and 1200x630 Open Graph preview
 * using authentic bundled Clicker Script TTF font rendering via Skia Canvas
 */
const generateInvitationAssets = async ({
  recipientName,
  templateId = null,
  designConfiguration = null,
  token = null,
  recipientId = null
}) => {
  const { template, templateFilePath, config, isFallback } = await resolveTemplateAndConfig(templateId);

  let effectiveConfig = { ...config };
  if (designConfiguration) {
    try {
      const parsed = typeof designConfiguration === 'string' ? JSON.parse(designConfiguration) : designConfiguration;
      effectiveConfig = { ...effectiveConfig, ...parsed };
    } catch (e) {
      // keep default config
    }
  }

  // Read native dimensions of background template
  const templateImage = await loadImage(templateFilePath);
  let canvasWidth = templateImage.width || 1080;
  let canvasHeight = templateImage.height || 1920;

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

  // Create main portrait canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Draw template background image 1:1
  ctx.drawImage(templateImage, 0, 0, canvasWidth, canvasHeight);

  if (recipientName) {
    const xPercent = effectiveConfig.xPosition ?? 0.1;
    const yPercent = effectiveConfig.yPosition ?? 0.565;
    const boxWidthPercent = effectiveConfig.textBoxWidth ?? 0.8;

    const fontScaleFactor = canvasWidth / 600;
    const baseFontSizePx = (effectiveConfig.fontSize || 20) * fontScaleFactor;

    const fontColour = effectiveConfig.fontColour || '#000000';
    const textAlignment = effectiveConfig.textAlignment || effectiveConfig.textAlign || 'center';

    const startX = xPercent * canvasWidth;
    const startY = yPercent * canvasHeight;
    const boxWidthPx = boxWidthPercent * canvasWidth;

    // Set canvas font specifically using bundled "Clicker Script"
    let currentFontSize = baseFontSizePx;
    ctx.font = `normal 400 ${currentFontSize}px "Clicker Script"`;

    // Auto-scale font down if text width exceeds text box width
    const minFontSizePx = 14 * fontScaleFactor;
    let textWidth = ctx.measureText(recipientName).width;
    while (textWidth > boxWidthPx && currentFontSize > minFontSizePx) {
      currentFontSize -= 1 * fontScaleFactor;
      ctx.font = `normal 400 ${currentFontSize}px "Clicker Script"`;
      textWidth = ctx.measureText(recipientName).width;
    }

    // Determine alignment coordinates
    let drawX = startX;
    if (textAlignment === 'center') {
      if (xPercent >= 0.4 || startX + boxWidthPx / 2 > canvasWidth) {
        drawX = canvasWidth / 2;
      } else {
        drawX = startX + boxWidthPx / 2;
      }
      ctx.textAlign = 'center';
    } else if (textAlignment === 'right') {
      drawX = startX + boxWidthPx;
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'left';
    }

    ctx.textBaseline = 'middle';
    ctx.fillStyle = fontColour;

    // Draw receiver name in authentic Clicker Script font
    ctx.fillText(recipientName, drawX, startY);
  }

  const portraitBuffer = canvas.toBuffer('image/png');

  // Generate 1200x630 WhatsApp Open Graph JPEG preview canvas
  const ogCanvas = createCanvas(1200, 630);
  const ogCtx = ogCanvas.getContext('2d');

  // Slate-50 background
  ogCtx.fillStyle = '#F8FAFC';
  ogCtx.fillRect(0, 0, 1200, 630);

  const padding = 40;
  const targetHeight = 630 - padding * 2;
  const scale = targetHeight / canvasHeight;
  const targetWidth = canvasWidth * scale;

  const dx = (1200 - targetWidth) / 2;
  const dy = padding;

  const portraitImageForOg = await loadImage(portraitBuffer);
  ogCtx.drawImage(portraitImageForOg, dx, dy, targetWidth, targetHeight);

  const ogBuffer = ogCanvas.toBuffer('image/jpeg', 90);

  // Persistent file names
  const fileIdentifier = token || recipientId || require('crypto').randomBytes(16).toString('hex');
  const mainFileName = `invite-${fileIdentifier}.png`;
  const ogFileName = `invite-${token || fileIdentifier}.jpg`;

  const candidates = getUploadCandidates();
  let savedRelativePath = `/uploads/generated/${mainFileName}`;

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
    fontFamilyUsed: 'Clicker Script',
    isFallback
  };
};

module.exports = {
  generateInvitationAssets,
  resolveTemplateAndConfig
};
