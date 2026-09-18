const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getTemplates, createTemplate, updateTemplate, saveTemplateFields, generatePreview } = require('../controllers/templateController');
const { protect, authorize } = require('../middleware/authMiddleware');

const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../uploads/templates');
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueId = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${uniqueId}-${safeBaseName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  
  const ext = path.extname(file.originalname || '').toLowerCase();
  
  const isMimeValid = allowedMimeTypes.includes(file.mimetype);
  const isExtValid = allowedExtensions.includes(ext);

  // Validate MIME and extension match expected types
  if (!isMimeValid || !isExtValid) {
    return cb(new Error('Invalid file format. Only .png, .jpg, .jpeg, and .pdf files are allowed.'), false);
  }

  // Cross check extension vs MIME type
  if (file.mimetype === 'application/pdf' && ext !== '.pdf') {
    return cb(new Error('File extension does not match PDF MIME type.'), false);
  }
  if (file.mimetype === 'image/png' && ext !== '.png') {
    return cb(new Error('File extension does not match PNG MIME type.'), false);
  }
  if (file.mimetype === 'image/jpeg' && (ext !== '.jpg' && ext !== '.jpeg')) {
    return cb(new Error('File extension does not match JPEG MIME type.'), false);
  }

  cb(null, true);
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB limit
});

const handleUploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large. Maximum allowed size is 25MB.' });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message || 'File upload rejected.' });
    }
    next();
  });
};

router.use(protect);
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'SENDER'));

router.route('/')
  .get(getTemplates)
  .post(handleUploadMiddleware, createTemplate);

router.route('/:id')
  .patch(updateTemplate);

router.post('/:id/fields', saveTemplateFields);
router.post('/:id/preview', generatePreview);

module.exports = router;
