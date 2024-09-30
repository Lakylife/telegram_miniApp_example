const { connection } = require('../db/db');

const updateTaskStatus = (req, res) => {
  const { userId, taskId, status } = req.body;
  const statusIdMap = {
    'start': 1,
    'claim': 2,
    'completed': 3
  };

  const statusId = statusIdMap[status];

  const updateQuery = `
    INSERT INTO user_tasks (user_id, task_id, status, status_id) 
    VALUES (?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE status = VALUES(status), status_id = VALUES(status_id)
  `;

  connection.query(updateQuery, [userId, taskId, status, statusId], (err, results) => {
    if (err) {
      console.error('Error updating task status:', err);
      res.status(500).send(`Failed to update task status: ${err.message}`);
    } else {
      res.json({
        message: `Task ${taskId} status updated to ${status} for user ${userId}`,
        statusId
      });
    }
  });
};

const completeTask = async (req, res) => {
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
    res.json({ message: 'Task completed and tokens awarded successfully.', tokenReward });
  } catch (error) {
    await connection.rollback();
    console.error('Error completing task:', error);
    res.status(500).send(`Failed to complete task: ${error.message}`);
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




const getUserTasks = (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (isNaN(userId)) {
    return res.status(400).send('Invalid user ID');
  }

  const tasksQuery = `
    SELECT DISTINCT
      t.id, t.icon, t.title, t.token_reward, t.link, t.priority, t.required_friends, t.required_tasks, t.required_tokens, 
      COALESCE(ut.status, 'start') AS status,
      (SELECT COUNT(*) FROM user_referrals WHERE user_id = ?) AS current_friends,
      (SELECT COUNT(*) FROM user_tasks WHERE user_id = ? AND status = 'completed') AS current_tasks,
      (SELECT tokens FROM users WHERE id = ?) AS current_tokens
    FROM tasks t
    LEFT JOIN (
      SELECT * FROM user_tasks 
      WHERE user_id = ?
    ) ut ON t.id = ut.task_id
    ORDER BY t.priority ASC
  `;

  connection.query(tasksQuery, [userId, userId, userId, userId], (err, results) => {
    if (err) {
      res.status(500).send('Failed to fetch tasks.');
    } else {
      res.json(results);
    }
  });
};


module.exports = {
  updateTaskStatus,
  completeTask,
  getUserTasks
};
