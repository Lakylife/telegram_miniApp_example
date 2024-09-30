const express = require('express');
const router = express.Router();
const { logMessage } = require('../controllers/gamesControllers');

router.post('/log', (req, res) => {
  const { message, data } = req.body;
  logMessage(message, data);
  res.status(200).json({ message: 'Log received' });
});

module.exports = router;

