const { connection } = require('../db/db');

function checkAndPayTokens(referrerId, userId, tokenAmount) {
  const updateReferrerTokensQuery = 'UPDATE users SET tokens = tokens + ? WHERE id = ?';
  const updateTokensPaidQuery = 'UPDATE user_referrals SET tokens_paid = 1 WHERE user_id = ? AND referred_user_id = ?';

  // Update referrer tokens
  connection.query(updateReferrerTokensQuery, [tokenAmount, referrerId], (err, result) => {
    if (err) {
      console.error('Error updating referrer tokens:', err);
      return;
    }
    console.log('Referrer tokens updated successfully:', result);

    // Update tokens_paid to 1
    connection.query(updateTokensPaidQuery, [referrerId, userId], (err, result) => {
      if (err) {
        console.error('Error updating tokens_paid:', err);
        return;
      }
      console.log('tokens_paid updated successfully:', result);
    });
  });
}

module.exports = checkAndPayTokens;
