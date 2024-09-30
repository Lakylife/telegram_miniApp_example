const { v4: uuidv4 } = require('uuid');
const db = require('../db/db').connection;
const redis = require('redis');
const client = redis.createClient();

const playGame = async (req, res) => {
  const { userId } = req.body;

  console.log(`Received play game request for userId: ${userId}`);

  try {
    const recentGames = await queryAsync(`
      SELECT id FROM game_activity 
      WHERE user_id = ? AND end_time > DATE_SUB(NOW(), INTERVAL 10 SECOND)
    `, [userId]);

    if (recentGames.length > 0) {
      console.log('Recently ended game exists. Cannot start a new game yet.');
      return res.status(400).json({ message: 'Please wait before starting a new game.' });
    }

    const activeGames = await queryAsync(`
      SELECT id, game_session_id FROM game_activity 
      WHERE user_id = ? AND game_success IS NULL AND end_time IS NULL
    `, [userId]);

    if (activeGames.length > 0) {
      const activeGameSessionId = activeGames[0].game_session_id;
      console.log('Active game already exists');
      return res.status(200).json({
        message: 'Active game already exists',
        gameSessionId: activeGameSessionId,
      });
    }

    const userRows = await queryAsync('SELECT tickets, is_premium, is_active FROM users WHERE id = ?', [userId]);

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userRows[0];

    if (user.tickets > 0) {
      await queryAsync('UPDATE users SET tickets = tickets - 1 WHERE id = ?', [userId]);

      const startTime = new Date();
      const isPremium = user.is_premium;
      const isActive = user.is_active;
      const gameSessionId = uuidv4();

      await queryAsync('INSERT INTO game_activity (id, user_id, game_session_id, start_time, is_premium, is_active, game_success) VALUES (?, ?, ?, ?, ?, ?, NULL)', [gameSessionId, userId, gameSessionId, startTime, isPremium, isActive]);

      console.log(`Game started: session ID ${gameSessionId}, user ID ${userId}`);
      res.status(200).json({
        message: 'Game started, 1 ticket deducted.',
        tickets: user.tickets - 1,
        gameSessionId: gameSessionId,
      });
    } else {
      console.log('Insufficient tickets for userId:', userId);
      res.status(400).json({ message: 'Insufficient tickets.' });
    }
  } catch (err) {
    console.error('Error handling play game request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const endGame = async (req, res) => {
  const { userId, tokensCollected, isPremium, isActive, boostUsed, gameSessionId } = req.body;

  console.log('Received request to end game:', req.body);

  if (!gameSessionId) {
    console.error('Missing gameSessionId for user:', userId);
    return res.status(400).json({ error: 'Missing game session ID' });
  }

  try {
    const updateGameQuery = `
      UPDATE game_activity
      SET activity_description = ?, tokens_earned = ?, end_time = NOW(), 
          tokens_collected = ?, game_success = 1, tokens_awarded = 1
      WHERE game_session_id = ? AND user_id = ? AND game_success IS NULL AND end_time IS NULL
    `;

    const updateGameParams = [
      `Game lasted ${isPremium ? (isActive ? '35' : '45') : '30'} seconds ${boostUsed ? 'with' : 'without'} boost`,
      tokensCollected,
      tokensCollected,
      gameSessionId,
      userId
    ];

    const result = await queryAsync(updateGameQuery, updateGameParams);

    if (result.affectedRows === 0) {
      console.log(`No active game activity found for userId: ${userId}, session ID: ${gameSessionId}`);
      return res.status(404).json({ message: 'Active game activity not found or already ended' });
    }

    const userResult = await queryAsync(`
      UPDATE users
      SET tokens = tokens + ?
      WHERE id = ?
    `, [tokensCollected, userId]);

    await addReferralBonus(userId, tokensCollected, 'game', null);

    console.log(`Game ended for userId: ${userId}, tokens collected: ${tokensCollected}, session ID: ${gameSessionId}`);
    res.status(200).json({ 
      message: 'Game activity recorded and tokens updated successfully',
      tokensCollected: tokensCollected
    });
  } catch (err) {
    console.error('Error ending game:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addReferralBonus = async (userId, tokens, activityType, taskId) => {
  try {
    const referrerResult = await queryAsync('SELECT invited_by, is_active FROM users WHERE id = ?', [userId]);

    const referralCode = referrerResult[0] ? referrerResult[0].invited_by : null;
    const isActive = referrerResult[0] ? referrerResult[0].is_active : false;

    if (referralCode) {
      const bonusMultiplier = isActive ? 0.15 : 0.10;
      const referralBonus = Math.floor(tokens * bonusMultiplier);
      await queryAsync('INSERT INTO referral_earnings (referrer_id, referred_user_id, tokens_earned, activity_type, task_id) VALUES ((SELECT id FROM users WHERE referral_code = ?), ?, ?, ?, ?)', [referralCode, userId, referralBonus, activityType, taskId]);
      console.log(`Referral bonus recorded: ${referralBonus} tokens for activity ${activityType}`);
    }
  } catch (err) {
    console.error('Error adding referral bonus:', err);
  }
};

const checkGameStatus = async (req, res) => {
  const { userId, gameSessionId } = req.query;

  try {
    const results = await queryAsync(`
      SELECT * FROM game_activity
      WHERE user_id = ? AND game_session_id = ?
    `, [userId, gameSessionId]);

    if (results.length === 0) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const game = results[0];
    const isActive = game.game_success === null && game.end_time === null;

    res.json({
      isActive,
      gameData: game
    });
  } catch (err) {
    console.error('Error checking game status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const queryAsync = (query, params) => {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

module.exports = {
  playGame,
  endGame,
  checkGameStatus,
};
