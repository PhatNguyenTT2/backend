const crypto = require('crypto');

/**
 * Generate a secure random reset token
 * @returns {string} - Random token
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash the reset token for storage
 * @param {string} token - Plain reset token
 * @returns {string} - Hashed token
 */
const hashResetToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Get reset token expiration time (1 hour from now)
 * @returns {Date} - Expiration date
 */
const getResetTokenExpiration = () => {
  return new Date(Date.now() + 60 * 60 * 1000); // 1 hour
};

module.exports = {
  generateResetToken,
  hashResetToken,
  getResetTokenExpiration
};
