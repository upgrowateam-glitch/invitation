const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getTemplates, createTemplate, updateTemplate, saveTemplateFields, generatePreview } = require('../controllers/templateController');
const { protect, authorize } = require('../middleware/authMiddleware');

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
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });

router.use(protect);
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'SENDER'));

router.route('/')
  .get(getTemplates)
  .post(upload.single('file'), createTemplate);

router.route('/:id')
  .patch(updateTemplate);

router.post('/:id/fields', saveTemplateFields);
router.post('/:id/preview', generatePreview);

module.exports = router;
