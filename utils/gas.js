const { ethers } = require('ethers');
const logger = require('./logger');

/**
 * Get the current gas price with a multiplier
 * @param {ethers.providers.Provider} provider - Ethers provider
 * @param {number} [multiplier=1.1] - Gas price multiplier
 * @returns {Promise<ethers.BigNumber>}
 */
async function getGasPrice(provider, multiplier = 1.1) {
  try {
    const gasPrice = await provider.getGasPrice();
    return gasPrice.mul(Math.floor(multiplier * 100)).div(100);
  } catch (error) {
    logger.warn(`Failed to estimate gas price: ${error.message}`);
    // Return a default gas price (1.5 gwei)
    return ethers.utils.parseUnits('1.5', 'gwei');
  }
}

/**
 * Estimate gas for a transaction with fallback
 * @param {Object} txObject - Transaction object
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {number} [defaultGasLimit=500000] - Default gas limit if estimation fails
 * @returns {Promise<ethers.BigNumber>}
 */
async function estimateGas(txObject, wallet, defaultGasLimit = 500000) {
  try {
    const gasEstimate = await wallet.estimateGas(txObject);
    // Add 20% buffer to estimated gas
    return gasEstimate.mul(120).div(100);
  } catch (error) {
    logger.warn(`Failed to estimate gas: ${error.message}`);
    // Return default gas limit
    return ethers.BigNumber.from(defaultGasLimit);
  }
}

module.exports = {
  getGasPrice,
  estimateGas
};