const express = require('express');
const router = express.Router();
const { getInvitationByToken, submitRsvp, downloadInvitation } = require('../controllers/publicController');

router.get('/invitation/:token', getInvitationByToken);
router.get('/invitation/:token/download', downloadInvitation);
router.post('/invitation/:token/rsvp', submitRsvp);

module.exports = router;
