// routes/users.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

router.post('/verify', usersController.verifyUser);
router.get('/:id', usersController.getUserData);
router.post('/increment-referrals-count', usersController.incrementReferralsCount);
router.post('/claim-referral-earnings', usersController.claimReferralEarnings);
router.post('/start-farming', usersController.startFarming);
router.post('/claim-farming-tokens', usersController.claimFarmingTokens);
router.post('/remove-referral-tokens', usersController.removeReferralTokens);
router.get('/farming-status/:userId', usersController.getFarmingStatus);
router.get('/:userId/check-congratulation', usersController.checkCongratulation);

module.exports = router;
