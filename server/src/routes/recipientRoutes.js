const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  getRecipients,
  getRecipientById,
  createRecipient,
  updateRecipient,
  deleteRecipient,
  importRecipients
} = require('../controllers/recipientController');

// Set up multer for file upload (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Protect all recipient routes
router.use(protect);

router.route('/')
  .get(getRecipients)
  .post(createRecipient);

router.post('/import', upload.single('file'), importRecipients);

router.route('/:id')
  .get(getRecipientById)
  .put(updateRecipient)
  .delete(deleteRecipient);

module.exports = router;
