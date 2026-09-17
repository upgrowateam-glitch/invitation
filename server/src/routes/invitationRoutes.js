const express = require('express');
const router = express.Router();
const {
  getInvitations,
  getInvitation,
  createInvitation,
  updateInvitation,
  deleteInvitation,
  getDashboardStats
} = require('../controllers/invitationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/stats').get(getDashboardStats);

router.route('/')
  .get(getInvitations)
  .post(createInvitation);

router.route('/:id')
  .get(getInvitation)
  .put(updateInvitation)
  .delete(deleteInvitation);

module.exports = router;
