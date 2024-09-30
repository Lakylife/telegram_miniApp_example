//routes/games.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gamesControllers');

router.post('/play', gameController.playGame);
router.post('/end-game', gameController.endGame);
//router.post('/add-daily-tickets', gameController.addDailyTickets);
router.get('/status', gameController.checkGameStatus);  // Nová trasa pro kontrolu stavu hry

module.exports = router;