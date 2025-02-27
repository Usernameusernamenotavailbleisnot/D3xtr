const axios = require('axios');
const axiosRetry = require('axios-retry');
const logger = require('../utils/logger');

// Configure axios-retry
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: error => {
    // Retry on network errors and 5xx responses
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response && error.response.status >= 500);
  }
});

/**
 * Register a wallet with Dextr Exchange
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Registration success
 */
async function registerUser(wallet, proxyAgent = null) {
  try {
    // First check if the user is already registered
    const isRegistered = await checkUserRegistration(wallet.address, proxyAgent);
    if (isRegistered) {
      logger.info(`Wallet ${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)} already registered`, wallet.address);
      return true;
    }
    
    logger.info(`Registering wallet ${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`, wallet.address);
    
    const url = 'https://app.dextr.exchange/worker/api/users/registerByWallet';
    const data = {
      walletAddress: wallet.address,
      referralBy: ""
    };
    
    const config = {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      },
      httpsAgent: proxyAgent
    };
    
    const response = await axios.post(url, data, config);
    
    if (response.data.status) {
      logger.success(`Registration successful for ${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`, wallet.address);
      return true;
    } else {
      logger.error(`Registration failed: ${response.data.msg}`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Registration error: ${error.message}`, wallet.address);
    return false;
  }
}

/**
 * Check if a wallet is already registered with Dextr Exchange
 * @param {string} walletAddress - Wallet address
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Registration status
 */
async function checkUserRegistration(walletAddress, proxyAgent = null) {
  try {
    const url = `https://app.dextr.exchange/worker/api/users/checkUserRegister/${walletAddress}`;
    
    const config = {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      },
      httpsAgent: proxyAgent
    };
    
    const response = await axios.get(url, config);
    
    return response.data.status && response.data.isRegisteredOnDB;
  } catch (error) {
    logger.error(`Check registration error: ${error.message}`, walletAddress);
    return false;
  }
}

module.exports = {
  registerUser,
  checkUserRegistration
};