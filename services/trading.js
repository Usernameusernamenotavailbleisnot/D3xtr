const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getGasPrice, estimateGas } = require('../utils/gas');
const { randomDelay } = require('../utils/delay');
const { getTokenBalance } = require('../utils/wallet');

// ABI for trading functions
const TRADING_ABI = [
  'function buyMarket(uint256 baseAmount) returns (bool)',
  'function sellMarket(uint256 baseAmount) returns (bool)'
];

/**
 * Execute market buy
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} pairConfig - Trading pair configuration
 * @returns {Promise<boolean>} - Buy success
 */
async function executeBuy(wallet, pairConfig) {
  const { name, contract, baseToken, minBuy, maxBuy } = pairConfig;
  
  try {
    // Calculate random amount between min and max
    const amount = minBuy + (Math.random() * (maxBuy - minBuy));
    const amountInWei = ethers.utils.parseUnits(amount.toString(), 18);
    
    logger.info(`Buying ${amount.toFixed(4)} ${baseToken} on ${name} pair`, wallet.address);
    
    // Get gas price
    const gasPrice = await getGasPrice(wallet.provider);
    
    // Use raw transaction approach
    // buyMarket function selector: 0xbc03f0e1
    const data = ethers.utils.hexConcat([
      '0xbc03f0e1', // Method ID for buyMarket(uint256)
      ethers.utils.defaultAbiCoder.encode(['uint256'], [amountInWei])
    ]);
    
    // Send raw transaction
    const rawTx = {
      to: contract,
      data,
      gasLimit: ethers.BigNumber.from(600000),
      gasPrice
    };
    
    const tx = await wallet.sendTransaction(rawTx);
    
    logger.info(`Buy transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`Buy successful for ${name}`, wallet.address);
      return true;
    } else {
      logger.error(`Buy failed for ${name}`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error executing buy on ${name}: ${error.message}`, wallet.address);
    return false;
  }
}

/**
 * Execute market sell
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} pairConfig - Trading pair configuration
 * @returns {Promise<boolean>} - Sell success
 */
async function executeSell(wallet, pairConfig) {
  const { name, contract, baseToken, minSell, maxSell } = pairConfig;
  
  try {
    // Calculate random amount between min and max
    const amount = minSell + (Math.random() * (maxSell - minSell));
    const amountInWei = ethers.utils.parseUnits(amount.toString(), 18);
    
    logger.info(`Selling ${amount.toFixed(4)} ${baseToken} on ${name} pair`, wallet.address);
    
    // Get gas price
    const gasPrice = await getGasPrice(wallet.provider);
    
    // Use raw transaction approach
    // sellMarket function selector: 0x51d5d0da
    const data = ethers.utils.hexConcat([
      '0x51d5d0da', // Method ID for sellMarket(uint256)
      ethers.utils.defaultAbiCoder.encode(['uint256'], [amountInWei])
    ]);
    
    // Send raw transaction
    const rawTx = {
      to: contract,
      data,
      gasLimit: ethers.BigNumber.from(600000),
      gasPrice
    };
    
    const tx = await wallet.sendTransaction(rawTx);
    
    logger.info(`Sell transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`Sell successful for ${name}`, wallet.address);
      return true;
    } else {
      logger.error(`Sell failed for ${name}`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error executing sell on ${name}: ${error.message}`, wallet.address);
    return false;
  }
}

/**
 * Execute trades on all configured pairs
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} tradeConfig - Trading configuration
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Overall success
 */
async function executeTrades(wallet, tradeConfig, proxyAgent = null) {
  const { pairs, maxRetries, delayMin, delayMax } = tradeConfig;
  let overallSuccess = true;
  
  for (const pair of pairs) {
    let buySuccess = false;
    let sellSuccess = false;
    let retries = 0;
    
    // Execute buy
    while (!buySuccess && retries < maxRetries) {
      if (retries > 0) {
        logger.info(`Retrying buy on ${pair.name} (${retries}/${maxRetries})`, wallet.address);
        await randomDelay(2, 5);
      }
      
      buySuccess = await executeBuy(wallet, pair);
      retries++;
    }
    
    if (!buySuccess) {
      logger.error(`Failed to buy on ${pair.name} after ${maxRetries} attempts`, wallet.address);
      overallSuccess = false;
    }
    
    // Add delay between buy and sell
    await randomDelay(delayMin, delayMax);
    
    // Reset retries for sell
    retries = 0;
    
    // Execute sell
    while (!sellSuccess && retries < maxRetries) {
      if (retries > 0) {
        logger.info(`Retrying sell on ${pair.name} (${retries}/${maxRetries})`, wallet.address);
        await randomDelay(2, 5);
      }
      
      sellSuccess = await executeSell(wallet, pair);
      retries++;
    }
    
    if (!sellSuccess) {
      logger.error(`Failed to sell on ${pair.name} after ${maxRetries} attempts`, wallet.address);
      overallSuccess = false;
    }
    
    // Add delay between pairs
    await randomDelay(delayMin, delayMax);
  }
  
  return overallSuccess;
}

module.exports = {
  executeBuy,
  executeSell,
  executeTrades
};