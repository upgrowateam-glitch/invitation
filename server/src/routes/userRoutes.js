const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, getSenders } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/senders').get(getSenders);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'ADMIN'), getUsers)
  .post(authorize('SUPER_ADMIN'), createUser);

router.route('/:id')
  .put(authorize('SUPER_ADMIN'), updateUser)
  .delete(authorize('SUPER_ADMIN'), deleteUser);

module.exports = router;
