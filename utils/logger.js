const chalk = require('chalk');
const moment = require('moment');

// Create a logger with colored output
const logger = {
  /**
   * Format the log message with timestamp and wallet address if provided
   * @param {string} level - Log level
   * @param {string} color - Chalk color function name
   * @param {string} message - Log message
   * @param {string} [walletAddress] - Optional wallet address
   * @returns {void}
   */
  log(level, color, message, walletAddress = null) {
    const timestamp = moment().format('DD/MM/YYYY - HH:mm:ss');
    let walletStr = '';
    
    if (walletAddress) {
      // Format wallet as first 4 chars and last 4 chars
      walletStr = walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4);
      walletStr = ` - ${walletStr}`;
    }
    
    console.log(chalk[color](`[${timestamp}${walletStr}] [${level}] ${message}`));
  },
  
  info(message, walletAddress = null) {
    this.log('INFO', 'blue', message, walletAddress);
  },
  
  success(message, walletAddress = null) {
    this.log('SUCCESS', 'green', message, walletAddress);
  },
  
  warn(message, walletAddress = null) {
    this.log('WARN', 'yellow', message, walletAddress);
  },
  
  error(message, walletAddress = null) {
    this.log('ERROR', 'red', message, walletAddress);
  },
  
  debug(message, walletAddress = null) {
    this.log('DEBUG', 'gray', message, walletAddress);
  }
};

module.exports = logger;