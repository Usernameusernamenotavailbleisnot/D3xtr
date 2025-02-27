const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getGasPrice } = require('../utils/gas');
const { randomDelay } = require('../utils/delay');

/**
 * Add liquidity to a token pair
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} pairConfig - Liquidity pair configuration
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Success status
 */
async function addLiquidity(wallet, pairConfig, proxyAgent = null) {
  const { 
    contract, 
    token1, 
    token2, 
    amount1, 
    amount2,
    slippage1,
    slippage2,
    minPrice,
    maxPrice
  } = pairConfig;
  
  try {
    logger.info(`Adding liquidity for ${token1.symbol}-${token2.symbol} pair`, wallet.address);
    
    // Convert amounts to wei
    const amount1Wei = ethers.utils.parseUnits(amount1.toString(), token1.decimals);
    const amount2Wei = ethers.utils.parseUnits(amount2.toString(), token2.decimals);
    
    // Calculate slippage amounts
    const slippageAmount1 = amount1Wei.mul(slippage1).div(100);
    const slippageAmount2 = amount2Wei.mul(slippage2).div(100);
    
    // Min/max amounts with slippage
    const minAmount1 = amount1Wei.sub(slippageAmount1);
    const minAmount2 = amount2Wei.sub(slippageAmount2);
    
    // Convert price ranges to wei
    const minPriceWei = ethers.utils.parseUnits(minPrice.toString(), 18);
    const maxPriceWei = ethers.utils.parseUnits(maxPrice.toString(), 18);
    
    // Get gas price with higher priority
    const gasPrice = await getGasPrice(wallet.provider, 1.3); // 1.3x multiplier for liquidity operations
    
    // Construct enableFreeLiquidity parameters
    // Method ID: 0x04898597
    // Function: enableFreeLiquidity((address,uint256,uint256,uint256) efl, address[] permitTokens, uint256[] minPermitPrices, uint256[] maxPermitPrices)
    
    // Build the efl tuple: (token1Address, amount1, minAmount1, minAmount2)
    const eflTuple = [
      token1.address,
      amount1Wei,
      minAmount1,
      minAmount2
    ];
    
    // Build arrays
    const permitTokens = [token2.address];
    const minPermitPrices = [minPriceWei];
    const maxPermitPrices = [maxPriceWei];
    
    // Encode parameters
    const data = ethers.utils.hexConcat([
      '0x04898597', // Method ID for enableFreeLiquidity
      ethers.utils.defaultAbiCoder.encode(
        ['tuple(address,uint256,uint256,uint256)', 'address[]', 'uint256[]', 'uint256[]'],
        [eflTuple, permitTokens, minPermitPrices, maxPermitPrices]
      )
    ]);
    
    // Create transaction with manually set gasLimit
    const rawTx = {
      to: contract,
      data,
      gasLimit: ethers.BigNumber.from(700000), // Higher gas limit for liquidity operations
      gasPrice
    };
    
    // Send raw transaction
    const tx = await wallet.sendTransaction(rawTx);
    
    logger.info(`Add liquidity transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`Added liquidity for ${token1.symbol}-${token2.symbol} pair successfully`, wallet.address);
      return true;
    } else {
      logger.error(`Failed to add liquidity for ${token1.symbol}-${token2.symbol} pair`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error adding liquidity for ${token1.symbol}-${token2.symbol} pair: ${error.message}`, wallet.address);
    // Log more details if available
    if (error.transaction) {
      logger.debug(`Transaction details: ${JSON.stringify(error.transaction)}`, wallet.address);
    }
    return false;
  }
}

/**
 * Add liquidity for all configured pairs
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} liquidityConfig - Liquidity configuration
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Overall success
 */
async function addAllLiquidity(wallet, liquidityConfig, proxyAgent = null) {
  const { pairs, maxRetries, delayMin, delayMax } = liquidityConfig;
  let overallSuccess = true;
  
  for (const pair of pairs) {
    // Add contract from the main config to each pair
    pair.contract = liquidityConfig.contract;
    
    let success = false;
    let retries = 0;
    
    while (!success && retries < maxRetries) {
      if (retries > 0) {
        logger.info(`Retrying add liquidity for ${pair.token1.symbol}-${pair.token2.symbol} (${retries}/${maxRetries})`, wallet.address);
        await randomDelay(2, 5);
      }
      
      success = await addLiquidity(wallet, pair, proxyAgent);
      retries++;
    }
    
    if (!success) {
      logger.error(`Failed to add liquidity for ${pair.token1.symbol}-${pair.token2.symbol} after ${maxRetries} attempts`, wallet.address);
      overallSuccess = false;
    }
    
    // Add delay between pairs
    if (pairs.indexOf(pair) < pairs.length - 1) {
      await randomDelay(delayMin, delayMax);
    }
  }
  
  return overallSuccess;
}

module.exports = {
  addLiquidity,
  addAllLiquidity
};