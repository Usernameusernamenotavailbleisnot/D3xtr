const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getGasPrice, estimateGas } = require('../utils/gas');
const { randomDelay } = require('../utils/delay');
const { getTokenBalance } = require('../utils/wallet');

// ABI for token mint function
const MINT_ABI = ['function mint(uint256 amount) returns (bool)'];

/**
 * Claim tokens from a faucet
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} faucetConfig - Faucet configuration
 * @param {string} faucetConfig.contract - Faucet contract address
 * @param {string} faucetConfig.symbol - Token symbol
 * @param {number} faucetConfig.amount - Amount to claim
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Claim success
 */
async function claimFaucet(wallet, faucetConfig, proxyAgent = null) {
  const { contract, symbol, amount } = faucetConfig;
  const tokenContract = new ethers.Contract(contract, MINT_ABI, wallet);
  const amountInWei = ethers.utils.parseUnits(amount.toString(), 18);
  
  logger.info(`Claiming ${amount} ${symbol} from faucet`, wallet.address);
  
  try {
    // Check if we already have the tokens
    const initialBalance = await getTokenBalance(contract, wallet.address, wallet.provider);
    if (!initialBalance.isZero()) {
      logger.info(`Already have ${ethers.utils.formatUnits(initialBalance, 18)} ${symbol}`, wallet.address);
      return true;
    }
    
    // Get gas price
    const gasPrice = await getGasPrice(wallet.provider);
    
    // Prepare transaction
    const mintTx = await tokenContract.populateTransaction.mint(amountInWei);
    
    // Estimate gas
    const gasLimit = await estimateGas(mintTx, wallet);
    
    // Send transaction
    const tx = await tokenContract.mint(amountInWei, {
      gasLimit,
      gasPrice
    });
    
    logger.info(`${symbol} faucet claim transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`Successfully claimed ${amount} ${symbol}`, wallet.address);
      return true;
    } else {
      logger.error(`Failed to claim ${symbol}`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error claiming ${symbol} faucet: ${error.message}`, wallet.address);
    return false;
  }
}

/**
 * Claim all faucets defined in configuration
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} faucetConfig - Faucet configuration
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Overall success
 */
async function claimAllFaucets(wallet, faucetConfig, proxyAgent = null) {
  const { tokens, maxRetries } = faucetConfig;
  let overallSuccess = true;
  
  for (const token of tokens) {
    let success = false;
    let retries = 0;
    
    while (!success && retries < maxRetries) {
      if (retries > 0) {
        logger.info(`Retrying ${token.symbol} faucet claim (${retries}/${maxRetries})`, wallet.address);
        // Wait before retrying
        await randomDelay(5, 10);
      }
      
      success = await claimFaucet(wallet, token, proxyAgent);
      retries++;
      
      if (success) {
        // Add delay between successful claims
        await randomDelay(faucetConfig.delayMin, faucetConfig.delayMax);
      }
    }
    
    if (!success) {
      logger.error(`Failed to claim ${token.symbol} faucet after ${maxRetries} attempts`, wallet.address);
      overallSuccess = false;
    }
  }
  
  return overallSuccess;
}

module.exports = {
  claimFaucet,
  claimAllFaucets
};
