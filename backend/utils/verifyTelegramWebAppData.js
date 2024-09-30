const crypto = require('crypto');

function verifyTelegramWebAppData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest();

  const checkString = initData
    .split('&')
    .filter(kv => kv.startsWith('hash=') === false)
    .map(kv => kv.replace('=', ''))
    .sort()
    .join('\n');

  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  const initDataHash = new URLSearchParams(initData).get('hash');

  return hash === initDataHash;
}

module.exports = verifyTelegramWebAppData;
