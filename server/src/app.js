const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { errorHandler } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const recipientRoutes = require('./routes/recipientRoutes');
const templateRoutes = require('./routes/templateRoutes');
const publicRoutes = require('./routes/publicRoutes');
const emailScheduler = require('./cron/emailScheduler');

const app = express();

// Initialize Cron Jobs
emailScheduler.init();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // allowing React to run freely for now
  crossOriginResourcePolicy: false, // allow serving pdfs
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const os = require('os');

// Static uploads - search all candidate locations
const uploadCandidates = [
  path.join(__dirname, '../../uploads'),
  path.join(process.cwd(), 'uploads'),
  path.join(process.cwd(), 'server/uploads'),
  path.join(__dirname, '../../client/dist/uploads'),
  path.join(os.tmpdir(), 'uploads')
];

// Handle missing template image files gracefully with default fallback to avoid 404s
app.get('/uploads/templates/:filename', (req, res, next) => {
  const filename = req.params.filename;
  const candidatePaths = [
    path.join(__dirname, '../../uploads/templates', filename),
    path.join(process.cwd(), 'uploads/templates', filename),
    path.join(process.cwd(), 'server/uploads/templates', filename),
    path.join(__dirname, '../../client/dist/uploads/templates', filename)
  ];

  if (candidatePaths.some(p => fs.existsSync(p))) {
    return next();
  }

  const defaultFallback = [
    path.join(__dirname, '../../uploads/templates/bni-template.png'),
    path.join(process.cwd(), 'uploads/templates/bni-template.png'),
    path.join(process.cwd(), 'server/uploads/templates/bni-template.png')
  ].find(p => fs.existsSync(p));

  if (defaultFallback) {
    return res.sendFile(defaultFallback);
  }
  next();
});

// Serve or dynamically generate social preview images (1200x630 JPEG for Open Graph / WhatsApp)
app.get('/uploads/social/:filename', async (req, res, next) => {
  const filename = req.params.filename;
  
  // 1. Check existing candidate directories
  for (const dir of uploadCandidates) {
    const candidatePath = path.join(dir, 'social', filename);
    if (fs.existsSync(candidatePath)) {
      res.contentType('image/jpeg');
      return res.sendFile(candidatePath);
    }
  }

  // 2. Dynamic generation on-the-fly if missing
  try {
    const tokenMatch = filename.replace(/^og-invite-/, '').replace(/^invite-/, '').replace(/\.\w+$/, '');
    
    let recipient = await prisma.recipient.findUnique({
      where: { token: tokenMatch }
    });

    if (!recipient && tokenMatch.length < 32) {
      recipient = await prisma.recipient.findFirst({
        where: { generatedPdfPath: { contains: tokenMatch } }
      });
    }

    let sourceBuffer = null;

    if (recipient && recipient.generatedPdfPath) {
      const relativePath = recipient.generatedPdfPath.replace(/^\//, '');
      const searchLocations = [
        path.join(__dirname, '../../', relativePath),
        path.join(process.cwd(), relativePath),
        path.join(process.cwd(), 'server', relativePath),
        path.join(__dirname, '../../client/dist', relativePath),
        path.join(os.tmpdir(), relativePath)
      ];
      const foundLoc = searchLocations.find(p => fs.existsSync(p));
      if (foundLoc) {
        sourceBuffer = fs.readFileSync(foundLoc);
      }
    }

    if (!sourceBuffer) {
      try {
        const { resolveTemplateAndConfig } = require('./utils/imageGenerator');
        const activeTpl = await resolveTemplateAndConfig(recipient?.templateId);
        if (activeTpl && activeTpl.templateFilePath) {
          sourceBuffer = fs.readFileSync(activeTpl.templateFilePath);
        }
      } catch (tfErr) {
        console.warn('Dynamic template fallback search error:', tfErr.message);
      }
    }

    if (sourceBuffer) {
      const sharp = require('sharp');
      const portraitResized = await sharp(sourceBuffer)
        .resize({ height: 550, fit: 'inside' })
        .toBuffer();

      const socialBuffer = await sharp({
        create: {
          width: 1200,
          height: 630,
          channels: 3,
          background: { r: 248, g: 250, b: 252 }
        }
      })
      .composite([{ input: portraitResized, gravity: 'center' }])
      .jpeg({ quality: 88 })
      .toBuffer();

      // Save to candidate directory for subsequent requests
      const targetDir = path.join(uploadCandidates[0], 'social');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, filename), socialBuffer);

      res.contentType('image/jpeg');
      return res.send(socialBuffer);
    }
  } catch (err) {
    console.error('Dynamic social image generation error:', err);
  }

  next();
});

uploadCandidates.forEach(dir => {
  if (fs.existsSync(dir)) {
    app.use('/uploads', express.static(dir));
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/public', publicRoutes);

// Serve React production build
const clientDistPath = path.join(__dirname, '../../client/dist');

// Intercept specific routes to inject Open Graph tags for WhatsApp sharing
app.get('/invitation/:token', async (req, res, next) => {
  try {
    const token = req.params.token;
    const recipient = await prisma.recipient.findUnique({
      where: { token },
      include: { invitation: true }
    });

    if (!recipient) return next();

    let html = fs.readFileSync(path.join(clientDistPath, 'index.html'), 'utf8');

    const clientHost = req.headers['x-forwarded-host'] || req.headers.host || '';
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const baseUrl = process.env.CLIENT_URL || (clientHost.includes('localhost') ? 'http://localhost:5173' : `${protocol}://${clientHost}`);
    
    const version = recipient.updatedAt ? new Date(recipient.updatedAt).getTime() : Date.now();
    const socialImageUrl = `${baseUrl}/uploads/social/invite-${token}.jpg?v=${version}`;

    // Properly escape dynamic values for HTML attributes
    const escapeHtml = (unsafe) => {
      if (!unsafe) return '';
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const safeReceiver = escapeHtml(recipient.name);
    
    const ogTitle = `BNI Invitation for ${safeReceiver}`;
    const ogDescription = `You are cordially invited to join us. Click to view your personalized invitation.`;
    const canonicalUrl = `${baseUrl}/invitation/${token}`;

    const ogTags = `
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${socialImageUrl}" />
    <meta property="og:image:secure_url" content="${socialImageUrl}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDescription}" />
    <meta name="twitter:image" content="${socialImageUrl}" />
    `;

    console.log('[DEBUG WhatsApp OG]', { baseUrl, socialImageUrl, token, title: ogTitle });

    html = html.replace('</head>', `${ogTags}</head>`);
    return res.send(html);
  } catch (err) {
    console.error("OG Tag Injection Error:", err);
    next();
  }
});

app.use(express.static(clientDistPath));

// Catch-all to serve index.html for React Router
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }
  if (req.path.startsWith('/uploads')) {
    return res.status(404).send('File not found');
  }
  next();
});

// Error handling
app.use(errorHandler);

module.exports = app;
