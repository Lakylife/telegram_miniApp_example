//routes/referrals.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

router.post('/claim', usersController.claimReferralEarnings);

module.exports = router;
