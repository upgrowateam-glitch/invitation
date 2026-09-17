const express = require('express');
const router = express.Router();
const { getInvitationByToken, submitRsvp } = require('../controllers/publicController');

router.get('/invitation/:token', getInvitationByToken);
router.post('/invitation/:token/rsvp', submitRsvp);

module.exports = router;
