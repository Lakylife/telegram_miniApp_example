const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const usersRouter = require('./routes/users');
const tasksRouter = require('./routes/tasks');
const gamesRoutes = require('./routes/games');
const referralsRouter = require('./routes/referrals');
const { connection, connectToDatabase } = require('./db/db');
const generateReferralCode = require('./utils/generateReferralCode');
const checkAndPayTokens = require('./utils/checkAndPayTokens');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cron = require('node-cron');
const { addDailyTickets } = require('./controllers/gamesControllers');

process.env.NTBA_FIX_319 = 1;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const app = express();
const port = process.env.PORT || 4215;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet()); // Add security headers
app.use(morgan('combined')); // Request logging

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

bot.setWebHook(`${WEBHOOK_URL}/bot${TELEGRAM_BOT_TOKEN}`).then(() => {
  console.log(`Webhook set to ${WEBHOOK_URL}/bot${TELEGRAM_BOT_TOKEN}`);
}).catch(err => {
  console.error('Error setting webhook:', err);
});

app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
  console.log('Received request from Telegram:', req.body);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const referralCode = match[1];
    const userId = msg.from.id;
    const isBot = msg.from.is_bot || false;
    const firstName = msg.from.first_name;
    const lastName = msg.from.last_name || '';
    const languageCode = msg.from.language_code || '';
    const isPremium = msg.from.is_premium || false;
    const addedToAttachmentMenu = msg.from.added_to_attachment_menu || false;
    const allowsWriteToPm = msg.from.allows_write_to_pm || false;
    const photoUrl = `https://t.me/i/userpic/320/${username}.jpg`;
    const userReferralCode = generateReferralCode();

    console.log(`Received /start command from @${username} with referral code: ${referralCode || 'None'}`);

    const welcomeMessage = `Hey @${username}${referralCode ?  `(referred by ${referralCode})` : ''}! 🚀 Welcome to MARS | Elon Musk - your gateway to the red planet in the world of decentralized finance! 🌑
    
Start your journey by exploring the vast Martian landscape and earn $MARS tokens with every step you take. 🪐 Boost your rewards and climb higher in this new frontier! 🚀

Don’t miss out on exclusive missions and presales that are out of this world. The universe is waiting for you to take control! 🌌

Got fellow space explorers? Bring them onboard! The more crew members, the greater the adventure! 👩‍🚀👨‍🚀

Remember: MarsERC is more than a project, it’s a revolution. Be a pioneer and claim your place among the stars. Infinite opportunities lie ahead! 🌠`;

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Start Game', web_app: { url: 'https://mars.pizzapenny.com/' } }],
          [{ text: 'Join community', url: 'https://t.me/marscoin_erc' }]
        ]
      }
    };

    await bot.sendMessage(chatId, welcomeMessage, options);

    const userQuery = 
      `INSERT INTO users (id, is_bot, first_name, last_name, username, language_code, is_premium, added_to_attachment_menu, allows_write_to_pm, photo_url, referral_code, referral_code_used, invited_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      username = VALUES(username), 
      first_name = VALUES(first_name), 
      last_name = VALUES(last_name), 
      language_code = VALUES(language_code), 
      is_premium = VALUES(is_premium), 
      added_to_attachment_menu = VALUES(added_to_attachment_menu), 
      allows_write_to_pm = VALUES(allows_write_to_pm), 
      photo_url = VALUES(photo_url),
      referral_code_used = IF(referral_code_used IS NULL, VALUES(referral_code_used), referral_code_used),
      invited_by = IF(invited_by IS NULL, VALUES(invited_by), invited_by)`;

    connection.query(userQuery, [userId, isBot, firstName, lastName, username, languageCode, isPremium, addedToAttachmentMenu, allowsWriteToPm, photoUrl, userReferralCode, referralCode, referralCode ? referralCode : null], (err, result) => {
      if (err) {
        console.error('Error inserting user data:', err);
        return;
      }

      console.log('User data stored successfully:', result);

      if (referralCode) {
        const getReferrerIdQuery = 'SELECT id FROM users WHERE referral_code = ?';
        connection.query(getReferrerIdQuery, [referralCode], (err, referrerResult) => {
          if (err) {
            console.error('Error fetching referrer user ID:', err);
            return;
          }
          if (referrerResult.length === 0) {
            console.error('Referrer not found.');
            return;
          }

          const referrerId = referrerResult[0].id;
          console.log('Referrer ID found:', referrerId);

          const updateReferralCountQuery = 'UPDATE users SET invited_users_count = invited_users_count + 1 WHERE id = ?';
          connection.query(updateReferralCountQuery, [referrerId], (err, referralUpdateResult) => {
            if (err) {
              console.error('Error updating referral count:', err);
              return;
            }

            console.log('Referral count updated successfully:', referralUpdateResult);

            const checkReferralExistQuery = 'SELECT * FROM user_referrals WHERE user_id = ? AND referred_user_id = ?';
            connection.query(checkReferralExistQuery, [referrerId, userId], (err, referralExistResult) => {
              if (err) {
                console.error('Error checking referral relationship:', err);
                return;
              }

              if (referralExistResult.length === 0) {
                const insertReferralQuery = 'INSERT INTO user_referrals (user_id, referred_user_id, referred_by_code) VALUES (?, ?, ?)';
                connection.query(insertReferralQuery, [referrerId, userId, referralCode], (err, referralInsertResult) => {
                  if (err) {
                    console.error('Error inserting referral relationship:', err);
                    return;
                  }

                  console.log('Referral relationship inserted successfully:', referralInsertResult);
                  checkAndPayTokens(referrerId, userId, 150, 0.10);
                });
              } else {
                console.log('Referral relationship already exists.');
                checkAndPayTokens(referrerId, userId, 150, 0.10);
              }
            });
          });
        });
      }
    });
  } catch (err) {
    console.error('Error handling /start command:', err);
  }
});

app.use('/api', usersRouter);
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/games', gamesRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

connectToDatabase();

// Schedule the daily tickets addition job at 23:59 every day
cron.schedule('59 23 * * *', () => {
  addDailyTickets();
  console.log('Daily tickets added at 23:59');
});
