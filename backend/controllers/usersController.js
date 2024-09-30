const moment = require('moment');
const { connection } = require('../db/db');
const crypto = require('crypto');
const querystring = require('querystring');
const generateReferralCode = require('../utils/generateReferralCode');
const schedule = require('node-schedule');
const tokensPerMinute = parseFloat(process.env.TOKEN_REWARD_PER_MINUTE);
const farmingDurationHours = parseFloat(process.env.FARMING_DURATION_HOURS);

const calculateTokensEarned = (startTime, endTime, isPremium) => {
  const duration = moment.duration(endTime.diff(startTime));
  const totalMinutes = duration.asMinutes();
  const tokensEarned = totalMinutes * tokensPerMinute;
  return isPremium ? tokensEarned * 1.15 : tokensEarned;
};

const verifyTelegramWebAppData = (initData) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  const dataCheckString = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join('\n');
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return hmac === hash;
};

exports.verifyUser = (req, res) => {
  const telegramInitData = req.body.initData;
  let referralCode = req.body.referralCode || null;
  console.log('Received verification request:', telegramInitData, 'with referral code:', referralCode);

  if (!telegramInitData) {
    console.error('No initData received.');
    return res.status(400).send('No initData received.');
  }

  const isValid = verifyTelegramWebAppData(telegramInitData);

  if (isValid) {
    console.log('Data validation succeeded.');
    try {
      const parsedData = querystring.parse(telegramInitData);
      const userData = JSON.parse(parsedData.user);
      console.log('Decoded user data:', userData);

      const userId = userData.id;
      const isBot = userData.is_bot || false;
      const firstName = userData.first_name;
      const lastName = userData.last_name || '';
      const username = userData.username || '';
      const languageCode = userData.language_code || '';
      const isPremium = userData.is_premium || false;
      const addedToAttachmentMenu = userData.added_to_attachment_menu || false;
      const allowsWriteToPm = userData.allows_write_to_pm || false;
      const photoUrl = `https://t.me/i/userpic/320/${username}.jpg`;
      const userReferralCode = generateReferralCode();

      if (!referralCode || referralCode === userReferralCode) {
        referralCode = null;
      }

      const query = `
        INSERT INTO users (id, is_bot, first_name, last_name, username, language_code, is_premium, added_to_attachment_menu, allows_write_to_pm, photo_url, referral_code, referral_code_used, invited_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE username=VALUES(username), first_name=VALUES(first_name), last_name=VALUES(last_name), language_code=VALUES(language_code), is_premium=VALUES(is_premium), added_to_attachment_menu=VALUES(added_to_attachment_menu), allows_write_to_pm=VALUES(allows_write_to_pm), photo_url=VALUES(photo_url), referral_code_used=VALUES(referral_code_used), invited_by=IF(invited_by IS NULL, VALUES(invited_by), invited_by)
      `;

      console.log(`Executing query: ${query}`);
      connection.query(query, [userId, isBot, firstName, lastName, username, languageCode, isPremium, addedToAttachmentMenu, allowsWriteToPm, photoUrl, userReferralCode, referralCode, referralCode ? referralCode : null], (err, result) => {
        if (err) {
          console.error('Error inserting user data:', err);
          return res.status(500).send('Data validation succeeded but failed to store user data.');
        }

        console.log('User data stored successfully:', result);

        if (referralCode) {
          const getReferrerIdQuery = 'SELECT id FROM users WHERE referral_code = ?';
          connection.query(getReferrerIdQuery, [referralCode], (err, referrerResult) => {
            if (err) {
              console.error('Error fetching referrer user ID:', err);
              return res.status(500).send('Failed to fetch referrer user ID.');
            }
            if (referrerResult.length === 0) {
              console.error('Referrer not found.');
              return res.status(400).send('Referrer not found.');
            }

            const referrerId = referrerResult[0].id;
            console.log('Referrer ID found:', referrerId);

            const updateReferralCountQuery = 'UPDATE users SET invited_users_count = invited_users_count + 1 WHERE id = ?';
            connection.query(updateReferralCountQuery, [referrerId], (err, referralUpdateResult) => {
              if (err) {
                console.error('Error updating referral count:', err);
                return res.status(500).send('Failed to update referral count.');
              }

              console.log('Referral count updated successfully:', referralUpdateResult);

              const checkReferralExistQuery = 'SELECT * FROM user_referrals WHERE user_id = ? AND referred_user_id = ?';
              connection.query(checkReferralExistQuery, [referrerId, userId], (err, referralExistResult) => {
                if (err) {
                  console.error('Error checking referral relationship:', err);
                  return res.status(500).send('Failed to check referral relationship.');
                }

                if (referralExistResult.length === 0) {
                  const insertReferralQuery = 'INSERT INTO user_referrals (user_id, referred_user_id, referred_by_code) VALUES (?, ?, ?)';
                  connection.query(insertReferralQuery, [referrerId, userId, referralCode], (err, referralInsertResult) => {
                    if (err) {
                      console.error('Error inserting referral relationship:', err);
                      return res.status(500).send('Failed to insert referral relationship.');
                    }

                    console.log('Referral relationship inserted successfully:', referralInsertResult);
                    addReferralBonus(referrerId, userId, 150, 'referral');
                  });
                } else {
                  console.log('Referral relationship already exists.');
                }
              });
            });
          });
        }
        exports.getUserDataAfterVerification(userId, res);
      });
    } catch (error) {
      console.error('Error decoding user data:', error);
      return res.status(500).send('Data validation succeeded but failed to process user data.');
    }
  } else {
    console.log('Data validation failed.');
    return res.status(400).send('Data validation failed.');
  }
};

exports.getUserDataAfterVerification = (userId, res) => {
  const userQuery = `SELECT users.*, (SELECT COUNT(*) FROM user_referrals WHERE user_referrals.user_id = users.id) as invited_users_count FROM users WHERE users.id = ? `;
  const tasksQuery = 'SELECT tasks.id, tasks.icon, tasks.title, tasks.token_reward, user_tasks.status_id, user_tasks.status FROM tasks LEFT JOIN user_tasks ON tasks.id = user_tasks.task_id AND user_tasks.user_id = ?';
  const referralsQuery = `SELECT u.id, u.first_name, u.username, u.tokens, u.referrals_count, u.referral_code_used, u.invited_by, (SELECT COUNT(*) FROM users WHERE invited_by = u.referral_code) as referred_users_count, (SELECT SUM(tokens_earned) FROM referral_earnings WHERE referrer_id = ?) as tokens_earned FROM users u WHERE u.invited_by = (SELECT referral_code FROM users WHERE id = ?)`;

  console.log(`Fetching data for user ID: ${userId}`);

  connection.query(userQuery, [userId], (err, userResults) => {
    if (err) {
      console.error('Error fetching user data:', err);
      return res.status(500).send('Failed to fetch user data.');
    }

    const user = userResults[0];
    console.log('User data:', user);

    connection.query(tasksQuery, [userId], (err, taskResults) => {
      if (err) {
        console.error('Error fetching user tasks:', err);
        return res.status(500).send('Failed to fetch user tasks.');
      }

      user.tasks = taskResults;
      console.log('User tasks:', taskResults);

      connection.query(referralsQuery, [userId, userId], (err, referralResults) => {
        if (err) {
          console.error('Error fetching user referrals:', err);
          return res.status(500).send('Failed to fetch user referrals.');
        }

        user.referrals = referralResults.filter((referral, index, self) =>
          index === self.findIndex((r) => r.id === referral.id) && referral.id !== userId
        );
        console.log('User referrals:', user.referrals);

        user.tokens_earned = referralResults.length > 0 ? referralResults[0].tokens_earned : 0;

        synchronizeUserTokens(userId, () => {
          res.json(user);
        });
      });
    });
  });
};

const synchronizeUserTokens = (userId, callback) => {
  const getUserTokensQuery = 'SELECT tokens FROM users WHERE id = ?';
  const getCompletedTasksQuery = 'SELECT SUM(tasks.token_reward) AS total_task_tokens FROM tasks JOIN user_tasks ON tasks.id = user_tasks.task_id WHERE user_tasks.user_id = ? AND user_tasks.status_id = 3';
  const getUserReferralsQuery = 'SELECT SUM(tokens_earned) AS total_referral_tokens FROM referral_earnings WHERE referrer_id = ? AND claimed = TRUE';
  const getGameTokensQuery = 'SELECT SUM(tokens_collected) AS game_tokens FROM game_activity WHERE user_id = ? AND tokens_awarded = 1';
  const getFarmingTokensQuery = 'SELECT SUM(tokens_earned) AS farming_tokens FROM farming_history WHERE user_id = ? AND tokens_claimed = 1';

  connection.query(getUserTokensQuery, [userId], (err, userTokensResult) => {
    if (err) {
      console.error('Error fetching user tokens:', err);
      return callback(err);
    }

    if (!userTokensResult || userTokensResult.length === 0) {
      console.error('No user found with ID:', userId);
      return callback(new Error('User not found'));
    }

    const userTokens = userTokensResult[0].tokens || 0;

    connection.query(getCompletedTasksQuery, [userId], (err, completedTasksResult) => {
      if (err) {
        console.error('Error fetching completed tasks:', err);
        return callback(err);
      }

      const taskTokens = completedTasksResult[0] ? (completedTasksResult[0].total_task_tokens || 0) : 0;

      connection.query(getUserReferralsQuery, [userId], (err, userReferralsResult) => {
        if (err) {
          console.error('Error fetching user referrals:', err);
          return callback(err);
        }

        const referralTokens = userReferralsResult[0] ? (userReferralsResult[0].total_referral_tokens || 0) : 0;

        connection.query(getGameTokensQuery, [userId], (err, gameTokensResult) => {
          if (err) {
            console.error('Error fetching game tokens:', err);
            return callback(err);
          }

          const gameTokens = gameTokensResult[0] ? (gameTokensResult[0].game_tokens || 0) : 0;

          connection.query(getFarmingTokensQuery, [userId], (err, farmingTokensResult) => {
            if (err) {
              console.error('Error fetching farming tokens:', err);
              return callback(err);
            }

            const farmingTokens = farmingTokensResult[0] ? (farmingTokensResult[0].farming_tokens || 0) : 0;

            const calculatedTokens = taskTokens + referralTokens + gameTokens + farmingTokens;

            console.log(`Calculated tokens for user ${userId}:`, {
              taskTokens,
              referralTokens,
              gameTokens,
              farmingTokens,
              calculatedTokens,
              currentUserTokens: userTokens
            });

            if (userTokens !== calculatedTokens) {
              const updateTokensQuery = 'UPDATE users SET tokens = ? WHERE id = ?';
              connection.query(updateTokensQuery, [calculatedTokens, userId], (err, updateTokensResult) => {
                if (err) {
                  console.error('Error updating user tokens:', err);
                  return callback(err);
                }

                console.log('User tokens synchronized successfully:', updateTokensResult);
                callback(null, calculatedTokens);
              });
            } else {
              console.log('No token synchronization needed');
              callback(null, userTokens);
            }
          });
        });
      });
    });
  });
};

const addReferralBonus = async (referrerId, referredUserId, tokens, activityType, taskId = null) => {
  const bonusTokens = Math.floor(tokens * 0.1); // 10% bonus
  const recordBonusQuery = 'INSERT INTO referral_earnings (referrer_id, referred_user_id, tokens_earned, activity_type, task_id) VALUES (?, ?, ?, ?, ?)';
  
  try {
    await connection.query(recordBonusQuery, [referrerId, referredUserId, bonusTokens, activityType, taskId]);
    console.log(`Referral bonus of ${bonusTokens} tokens recorded for user ${referrerId} for ${activityType} activity of user ${referredUserId}`);
  } catch (error) {
    console.error('Error recording referral bonus:', error);
  }
};

exports.incrementReferralsCount = (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  console.log(`Attempting to increment referrals count for user ID: ${userId}`);

  const checkClickTimeQuery = 'SELECT last_click FROM referral_clicks WHERE user_id = ? ORDER BY last_click DESC LIMIT 1';
  connection.query(checkClickTimeQuery, [userId], (err, result) => {
    if (err) {
      console.error('Error checking last click time:', err);
      return res.status(500).send('Failed to check last click time.');
    }

    const now = new Date();
    console.log('Current time:', now);
    if (result.length > 0) {
      const lastClickTime = new Date(result[0].last_click);
      console.log('Last click time:', lastClickTime);
      const timeDiff = (now - lastClickTime) / 1000 / 60;

      if (timeDiff < 1) {
        console.log('Click action too frequent. Ignoring click.');
        return res.status(429).send('Too many requests. Please wait a while before trying again.');
      }
    }

    const incrementReferralsCountQuery = 'UPDATE users SET referrals_count = LEAST(referrals_count + 1, 499) WHERE id = ?';
    connection.query(incrementReferralsCountQuery, [userId], (err, result) => {
      if (err) {
        console.error('Error incrementing referrals count:', err);
        return res.status(500).send('Failed to increment referrals count.');
      }

      console.log('Referrals count incremented successfully:', result);

      const logClickTimeQuery = 'INSERT INTO referral_clicks (user_id, last_click) VALUES (?, ?)';
      connection.query(logClickTimeQuery, [userId, now], (err, result) => {
        if (err) {
          console.error('Error logging click time:', err);
          return res.status(500).send('Failed to log click time.');
        }

        console.log('Click time logged successfully:', result);
        res.sendStatus(200);
      });
    });
  });
};

exports.claimReferralEarnings = async (req, res) => {
  const { referrerId } = req.body;

  try {
    await connection.beginTransaction();

    const getUnclaimedEarningsQuery = 'SELECT SUM(tokens_earned) AS total_earnings FROM referral_earnings WHERE referrer_id = ? AND claimed = FALSE';
    const [earningsResult] = await queryAsync(getUnclaimedEarningsQuery, [referrerId]);

    const totalEarnings = Math.floor(earningsResult.total_earnings) || 0;

    if (totalEarnings > 0) {
      const updateTokensQuery = 'UPDATE users SET tokens = tokens + ? WHERE id = ?';
      const updateTokensResult = await queryAsync(updateTokensQuery, [totalEarnings, referrerId]);

      if (updateTokensResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(500).json({ error: 'Failed to update user tokens.' });
      }

      const markEarningsClaimedQuery = 'UPDATE referral_earnings SET claimed = TRUE WHERE referrer_id = ? AND claimed = FALSE';
      const markEarningsClaimedResult = await queryAsync(markEarningsClaimedQuery, [referrerId]);

      if (markEarningsClaimedResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(500).json({ error: 'Failed to mark earnings as claimed.' });
      }

      await connection.commit();

      // Znovu načteme synchronizaci tokenů po připsání referral tokenů
      synchronizeUserTokens(referrerId, (err, synchronizedTokens) => {
        if (err) {
          console.error('Error synchronizing user tokens:', err);
          return res.status(500).json({ error: 'Failed to synchronize user tokens.' });
        }
        res.json({ message: `Claimed ${totalEarnings} tokens successfully.`, claimedTokens: totalEarnings, synchronizedTokens });
      });
    } else {
      await connection.rollback();
      res.json({ message: 'No tokens to claim.' });
    }
  } catch (error) {
    await connection.rollback();
    console.error('Error claiming referral earnings:', error);
    res.status(500).json({ error: 'Failed to claim referral earnings.' });
  }
};

// Helper function to promisify database queries
const queryAsync = (query, params) => {
  return new Promise((resolve, reject) => {
    connection.query(query, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

exports.getUserData = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const userResults = await queryAsync('SELECT * FROM users WHERE id = ?', [userId]);
    const user = userResults[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const taskResults = await queryAsync('SELECT tasks.id, tasks.icon, tasks.title, tasks.token_reward, user_tasks.status_id, user_tasks.status FROM tasks LEFT JOIN user_tasks ON tasks.id = user_tasks.task_id AND user_tasks.user_id = ?', [userId]);
    user.tasks = taskResults;

    const referralResults = await queryAsync('SELECT u.id, u.first_name, u.username, u.tokens, u.referrals_count, u.referral_code_used, u.invited_by, u.photo_url, (SELECT COUNT(*) FROM users WHERE invited_by = u.referral_code) as referred_users_count FROM users u WHERE u.invited_by = (SELECT referral_code FROM users WHERE id = ?)', [userId]);
    user.referrals = referralResults.filter((referral, index, self) => index === self.findIndex((r) => r.id === referral.id) && referral.id !== userId);

    const referralEarningsResults = await queryAsync('SELECT SUM(tokens_earned) AS total_earned FROM referral_earnings WHERE referrer_id = ? AND claimed = FALSE', [userId]);
    user.referralEarnings = referralEarningsResults[0].total_earned || 0;

    res.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).send('Failed to fetch user data.');
  }
};

exports.startFarming = (req, res) => {
  const { userId } = req.body;
  console.log(`Starting farming for user ID: ${userId}`);

  const startTime = moment().format('YYYY-MM-DD HH:mm:ss');
  const endTime = moment().add(8, 'hours').format('YYYY-MM-DD HH:mm:ss');
  const tokensPerMinute = 0.185416666666667;

  const checkUnclaimedQuery = 'SELECT * FROM farming_history WHERE user_id = ? AND tokens_claimed = 0';
  connection.query(checkUnclaimedQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error checking unclaimed farming:', err);
      return res.status(500).send('Failed to check unclaimed farming.');
    }

    if (results.length > 0) {
      return res.status(400).send('Farming is already in progress.');
    }

    const insertFarmingHistoryQuery = `INSERT INTO farming_history (user_id, tokens_earned, start_time, end_time, tokens_claimed, referral_bonus_paid) VALUES (?, 0, ?, ?, 0, 0)`;
    connection.query(insertFarmingHistoryQuery, [userId, startTime, endTime], (err, results) => {
      if (err) {
        console.error('Error inserting farming history:', err);
        return res.status(500).send('Failed to insert farming history.');
      }

      console.log('Farming history inserted successfully:', results);
      res.send({ message: 'Farming started successfully.', endTime });

      // Adding a process to update tokens every minute
      const updateTokens = () => {
        const currentTime = moment();
        if (currentTime.isAfter(endTime)) {
          clearInterval(intervalId);
          // Ensure final update to tokens_earned at the end of farming
          const elapsedMinutes = 8 * 60; // 8 hours in minutes
          const tokensEarned = (elapsedMinutes * tokensPerMinute).toFixed(6);
          const finalUpdateQuery = 'UPDATE farming_history SET tokens_earned = ?, processed = 1 WHERE user_id = ? AND tokens_claimed = 0';
          connection.query(finalUpdateQuery, [tokensEarned, userId], (err, results) => {
            if (err) {
              console.error('Error during final token update:', err);
            } else {
              console.log('Final tokens update at end of farming:', results);
            }
          });
        } else {
          const elapsedMinutes = moment().diff(moment(startTime), 'minutes');
          const tokensEarned = (elapsedMinutes * tokensPerMinute).toFixed(6);
          const updateTokensQuery = 'UPDATE farming_history SET tokens_earned = ? WHERE user_id = ? AND tokens_claimed = 0';
          connection.query(updateTokensQuery, [tokensEarned, userId], (err, results) => {
            if (err) {
              console.error('Error updating tokens:', err);
            } else {
              console.log(`Tokens updated successfully for user ${userId}: ${tokensEarned} tokens earned`);
            }
          });
        }
      };

      console.log('Starting token update interval');
      const intervalId = setInterval(updateTokens, 60000); // Update every minute
    });
  });
};

// Přidání funkce pro aktualizaci statusu uživatele
const updateActiveStatus = async (userId) => {
  try {
    // Podmínky pro nastavení statusu "aktivní"
    const taskCountQuery = 'SELECT COUNT(*) AS completedTasks FROM user_tasks WHERE user_id = ? AND status = "completed"';
    const referralCountQuery = 'SELECT COUNT(*) AS invitedUsers FROM user_referrals WHERE user_id = ?';
    const farmingCountQuery = 'SELECT COUNT(*) AS farmingSessions FROM farming_history WHERE user_id = ? AND tokens_claimed = 1';
    const gameCountQuery = 'SELECT COUNT(*) AS gamesPlayed FROM game_activity WHERE user_id = ? AND game_success = 1';

    const [taskResult, referralResult, farmingResult, gameResult] = await Promise.all([
      queryAsync(taskCountQuery, [userId]),
      queryAsync(referralCountQuery, [userId]),
      queryAsync(farmingCountQuery, [userId]),
      queryAsync(gameCountQuery, [userId])
    ]);

    const isActive = (
      taskResult[0].completedTasks >= 10 &&
      referralResult[0].invitedUsers >= 5 &&
      farmingResult[0].farmingSessions >= 3 &&
      gameResult[0].gamesPlayed >= 10
    );

    const updateStatusQuery = 'UPDATE users SET is_active = ? WHERE id = ?';
    await queryAsync(updateStatusQuery, [isActive, userId]);

    console.log(`User ${userId} active status updated to ${isActive}`);
  } catch (error) {
    console.error('Error updating user active status:', error);
  }
};

// Volání funkce při relevantních akcích, např. při splnění úkolu
exports.completeTask = async (req, res) => {
  const { userId, taskId } = req.body;

  try {
    await connection.beginTransaction();

    const userTasks = await queryAsync('SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ?', [userId, taskId]);
    
    if (userTasks.length > 0 && userTasks[0].status === 'completed') {
      await connection.rollback();
      return res.status(400).send(`Task ${taskId} already completed for user ${userId}`);
    }

    const taskResults = await queryAsync('SELECT token_reward FROM tasks WHERE id = ?', [taskId]);
    
    if (taskResults.length === 0) {
      await connection.rollback();
      return res.status(500).send('Failed to retrieve task reward.');
    }

    const tokenReward = taskResults[0].token_reward;

    await queryAsync('UPDATE user_tasks SET status = "completed", status_id = 3 WHERE user_id = ? AND task_id = ?', [userId, taskId]);
    await queryAsync('UPDATE users SET tokens = tokens + ? WHERE id = ?', [tokenReward, userId]);

    const referrerResult = await queryAsync('SELECT invited_by FROM users WHERE id = ?', [userId]);

    if (referrerResult.length > 0 && referrerResult[0].invited_by) {
      const referralCode = referrerResult[0].invited_by;
      const referrerIdResult = await queryAsync('SELECT id FROM users WHERE referral_code = ?', [referralCode]);

      if (referrerIdResult.length > 0) {
        const referrerId = referrerIdResult[0].id;
        const referralBonus = Math.floor(tokenReward * 0.10);

        await queryAsync('INSERT INTO referral_earnings (referrer_id, referred_user_id, tokens_earned, activity_type, task_id) VALUES (?, ?, ?, "task", ?)', 
                          [referrerId, userId, referralBonus, taskId]);
      }
    }

    await connection.commit();
    await updateActiveStatus(userId);  // Aktualizace statusu uživatele

    res.json({ message: 'Task completed and tokens awarded successfully.', tokenReward });
  } catch (error) {
    await connection.rollback();
    console.error('Error completing task:', error);
    res.status(500).send(`Failed to complete task: ${error.message}`);
  }
};

exports.claimFarmingTokens = async (req, res) => {
  const { userId } = req.body;
  console.log(`Claiming farming tokens for user ID: ${userId}`);

  try {
    await new Promise((resolve, reject) => {
      connection.beginTransaction(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    const farmingResults = await new Promise((resolve, reject) => {
      const selectFarmingQuery = 'SELECT * FROM farming_history WHERE user_id = ? AND tokens_claimed = 0 ORDER BY end_time DESC LIMIT 1';
      connection.query(selectFarmingQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('Farming results:', farmingResults);

    if (!farmingResults || farmingResults.length === 0) {
      console.log('No farming activity found for user:', userId);
      await new Promise((resolve, reject) => {
        connection.rollback(err => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.status(400).send('No farming activity found.');
    }

    const farmingRecord = farmingResults[0];
    console.log('Farming record:', farmingRecord);

    const currentTime = moment();
    const endTime = moment(farmingRecord.end_time);

    if (currentTime.isBefore(endTime)) {
      console.log('Farming is still in progress for user:', userId);
      await new Promise((resolve, reject) => {
        connection.rollback(err => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.status(400).send('Farming is still in progress.');
    }

    const tokens = parseFloat(farmingRecord.tokens_earned).toFixed(6);

    await new Promise((resolve, reject) => {
      const updateTokensQuery = 'UPDATE users SET tokens = tokens + ? WHERE id = ?';
      connection.query(updateTokensQuery, [tokens, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      const updateFarmingHistoryQuery = 'UPDATE farming_history SET tokens_claimed = 1 WHERE id = ?';
      connection.query(updateFarmingHistoryQuery, [farmingRecord.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const referrerResults = await new Promise((resolve, reject) => {
      const getReferrerQuery = 'SELECT invited_by FROM users WHERE id = ?';
      connection.query(getReferrerQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log('Referrer results:', referrerResults);

    if (referrerResults.length > 0 && referrerResults[0].invited_by) {
      const referralCode = referrerResults[0].invited_by;
      const referrerIdResults = await new Promise((resolve, reject) => {
        const getReferrerIdQuery = 'SELECT id FROM users WHERE referral_code = ?';
        connection.query(getReferrerIdQuery, [referralCode], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      console.log('Referrer ID results:', referrerIdResults);

      if (referrerIdResults.length > 0) {
        const referrerId = referrerIdResults[0].id;
        await addReferralBonus(referrerId, userId, parseFloat(tokens), 'farming');
      }
    }

    await new Promise((resolve, reject) => {
      connection.commit(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.send(`Claimed ${tokens} tokens successfully.`);
  } catch (error) {
    await new Promise((resolve) => {
      connection.rollback(() => resolve());
    });
    console.error('Error claiming farming tokens:', error);
    res.status(500).send('Failed to claim farming tokens.');
  }
};

exports.getFarmingStatus = (req, res) => {
  const userId = req.params.userId;

  const query = `SELECT * FROM farming_history WHERE user_id = ? AND tokens_claimed = 0 ORDER BY end_time DESC LIMIT 1`;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching farming status:', err);
      return res.status(500).send('Failed to fetch farming status.');
    }

    if (results.length === 0) {
      return res.json({ inProgress: false, readyToClaim: false });
    }

    const farmingRecord = results[0];
    const currentTime = moment();
    const endTime = moment(farmingRecord.end_time);

    if (currentTime.isBefore(endTime)) {
      const duration = moment.duration(endTime.diff(currentTime));
      const earnedTokens = farmingRecord.tokens_earned * (1 - duration.asMilliseconds() / (8 * 60 * 60 * 1000));
      return res.json({
        inProgress: true,
        tokensEarned: parseFloat(earnedTokens.toFixed(3)),
        endTime: endTime.format(),
      });
    } else {
      return res.json({
        inProgress: false,
        readyToClaim: true,
        tokensEarned: farmingRecord.tokens_earned,
      });
    }
  });
};

exports.removeReferralTokens = (req, res) => {
  const { referrerId, referredUserId } = req.body;

  console.log(`Removing referral tokens for referrer ID: ${referrerId}, referred user ID: ${referredUserId}`);

  const checkReferralQuery = 'SELECT tokens_paid FROM user_referrals WHERE user_id = ? AND referred_user_id = ?';
  connection.query(checkReferralQuery, [referrerId, referredUserId], (err, referralResult) => {
    if (err) {
      console.error('Error checking referral relationship:', err);
      return res.status(500).send('Failed to check referral relationship.');
    }

    if (referralResult.length > 0 && referralResult[0].tokens_paid) {
      const updateTokensQuery = 'UPDATE users SET tokens = tokens - 150 WHERE id = ?';
      connection.query(updateTokensQuery, [referrerId], (err, updateTokensResult) => {
        if (err) {
          console.error('Error updating tokens for referrer:', err);
          return res.status(500).send('Failed to update tokens for referrer.');
        }

        console.log('Tokens removed successfully from referrer:', updateTokensResult);

        const markTokensUnpaidQuery = 'UPDATE user_referrals SET tokens_paid = FALSE WHERE user_id = ? AND referred_user_id = ?';
        connection.query(markTokensUnpaidQuery, [referrerId, referredUserId], (err, markTokensUnpaidResult) => {
          if (err) {
            console.error('Error marking tokens as unpaid:', err);
            return res.status(500).send('Failed to mark tokens as unpaid.');
          }

          console.log('Tokens marked as unpaid:', markTokensUnpaidResult);
          res.send('Referral tokens removed successfully.');
        });
      });
    } else {
      res.send('No tokens to remove.');
    }
  });
};

const awardDailyTickets = () => {
  console.log('Adding daily tickets');

  connection.beginTransaction((err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      return;
    }

    const updatePremiumTicketsQuery = `
      UPDATE users 
      SET tickets = LEAST(tickets + 4, 65), has_seen_congratulation = 0, daily_tickets = 4 
      WHERE is_premium = 1
    `;

    connection.query(updatePremiumTicketsQuery, (err) => {
      if (err) {
        return connection.rollback(() => {
          console.error('Error adding daily tickets for premium users:', err);
        });
      }

      const updateNonPremiumTicketsQuery = `
        UPDATE users 
        SET tickets = LEAST(tickets + 2, 65), has_seen_congratulation = 0, daily_tickets = 2 
        WHERE is_premium = 0 AND is_active = 0
      `;

      connection.query(updateNonPremiumTicketsQuery, (err) => {
        if (err) {
          return connection.rollback(() => {
            console.error('Error adding daily tickets for non-premium users:', err);
          });
        }

        const updateActiveUsersQuery = `
          UPDATE users 
          SET tickets = LEAST(tickets + 10, 65), has_seen_congratulation = 0, daily_tickets = 10 
          WHERE is_active = 1
        `;

        connection.query(updateActiveUsersQuery, (err) => {
          if (err) {
            return connection.rollback(() => {
              console.error('Error adding daily tickets for active users:', err);
            });
          }

          connection.commit((err) => {
            if (err) {
              return connection.rollback(() => {
                console.error('Error committing transaction:', err);
              });
            }
            console.log('Daily tickets added to all users');
          });
        });
      });
    });
  });
};

const checkCongratulation = (req, res) => {
  const userId = req.params.userId;

  const query = `SELECT has_seen_congratulation, daily_tickets FROM users WHERE id = ?`;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching congratulation status:', err);
      return res.status(500).send('Failed to fetch congratulation status.');
    }

    if (results.length === 0) {
      return res.status(404).send('User not found.');
    }

    const { has_seen_congratulation, daily_tickets } = results[0];
    if (has_seen_congratulation) {
      return res.json({ showCongratulation: false });
    }

    const updateQuery = `UPDATE users SET has_seen_congratulation = 1 WHERE id = ?`;
    connection.query(updateQuery, [userId], (err) => {
      if (err) {
        console.error('Error updating congratulation status:', err);
        return res.status(500).send('Failed to update congratulation status.');
      }

      res.json({ showCongratulation: true, daily_tickets });
    });
  });
};

// Schedule the daily tickets addition job at 23:59 every day
schedule.scheduleJob('59 23 * * *', awardDailyTickets);

module.exports = {
  verifyUser: exports.verifyUser,
  getUserDataAfterVerification: exports.getUserDataAfterVerification,
  incrementReferralsCount: exports.incrementReferralsCount,
  claimReferralEarnings: exports.claimReferralEarnings,
  getUserData: exports.getUserData,
  startFarming: exports.startFarming,
  claimFarmingTokens: exports.claimFarmingTokens,
  getFarmingStatus: exports.getFarmingStatus,
  removeReferralTokens: exports.removeReferralTokens,
  awardDailyTickets: awardDailyTickets,
  checkCongratulation: checkCongratulation
};
