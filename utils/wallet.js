const { ethers } = require('ethers');
const logger = require('./logger');

/**
 * Get token balance
 * @param {string} tokenAddress - Token contract address
 * @param {string} walletAddress - Wallet address
 * @param {ethers.providers.Provider} provider - Ethers provider
 * @returns {Promise<ethers.BigNumber>} - Token balance
 */
async function getTokenBalance(tokenAddress, walletAddress, provider) {
  try {
    const abi = ['function balanceOf(address) view returns (uint256)'];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    return await contract.balanceOf(walletAddress);
  } catch (error) {
    logger.error(`Failed to get token balance: ${error.message}`);
    return ethers.BigNumber.from(0);
  }
}

/**
 * Get ETH balance
 * @param {string} walletAddress - Wallet address
 * @param {ethers.providers.Provider} provider - Ethers provider
 * @returns {Promise<ethers.BigNumber>} - ETH balance
 */
async function getEthBalance(walletAddress, provider) {
  try {
    return await provider.getBalance(walletAddress);
  } catch (error) {
    logger.error(`Failed to get ETH balance: ${error.message}`);
    return ethers.BigNumber.from(0);
  }
}

module.exports = {
  getTokenBalance,
  getEthBalance
};