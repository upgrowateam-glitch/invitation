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
    const baseUrl = process.env.CLIENT_URL || (clientHost.includes('localhost') ? 'https://carl-fully-boat-throw.trycloudflare.com' : `https://${clientHost}`);
    
    // Check if generatedPdfPath exists; it might be null for older records
    if (!recipient.generatedPdfPath) {
      return next();
    }
    
    const isAbsolute = recipient.generatedPdfPath.startsWith('http');
    let ogPath = recipient.generatedPdfPath;
    if (ogPath.includes('/invite-')) {
      ogPath = ogPath.replace('/invite-', '/og-invite-');
    }
    const imageUrl = isAbsolute ? ogPath : `${baseUrl}${ogPath}`;

    const hostName = recipient.senderName || recipient.invitation?.hostName || 'us';
    
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
    const ogDescription = `You are cordially invited`;

    const ogTags = `
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${baseUrl}/invitation/${token}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDescription}" />
    <meta name="twitter:image" content="${imageUrl}" />
    `;

    console.log('[DEBUG WhatsApp OG]', { baseUrl, imageUrl, token, title: ogTitle });

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
