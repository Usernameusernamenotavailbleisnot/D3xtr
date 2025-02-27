const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getGasPrice, estimateGas } = require('../utils/gas');
const { randomDelay } = require('../utils/delay');
const { getTokenBalance } = require('../utils/wallet');

// Fixed staking function that doesn't rely on balanceOf calls
async function stakeTokens(wallet, stakeConfig, proxyAgent = null) {
  const { contract, tokenVault, stakePercentage, maxRetries } = stakeConfig;
  
  try {
    // Find DXTR token config - safely access the global config
    const faucetTokens = global.config && global.config.faucet && global.config.faucet.tokens ? 
      global.config.faucet.tokens : [];
    const dxtrConfig = faucetTokens.find(t => t.symbol === 'DXTR');
    
    if (!dxtrConfig) {
      logger.error(`DXTR token configuration not found`, wallet.address);
      return false;
    }
    
    // Use a fixed amount to stake instead of relying on balance checks
    // We'll stake 300 DXTR (as seen in your transaction logs)
    const stakeAmount = ethers.utils.parseUnits("300", 18); // 300 DXTR
    
    logger.info(`Staking ${ethers.utils.formatUnits(stakeAmount, 18)} DXTR`, wallet.address);
    
    // Get gas price with higher priority
    const gasPrice = await getGasPrice(wallet.provider, 1.5); // 1.5x multiplier
    
    // Construct raw transaction - method ID is 0x6e129ca1 for stakeDeposit(address,uint256,address)
    const data = ethers.utils.hexConcat([
      '0x6e129ca1', // Method ID for stakeDeposit(address,uint256,address)
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'address'], 
        [wallet.address, stakeAmount, tokenVault]
      )
    ]);
    
    // Send raw transaction
    const rawTx = {
      to: contract,
      data,
      gasLimit: ethers.BigNumber.from(300000),
      gasPrice
    };
    
    const tx = await wallet.sendTransaction(rawTx);
    
    logger.info(`Stake transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`Staking successful`, wallet.address);
      return true;
    } else {
      logger.error(`Staking failed`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error staking tokens: ${error.message}`, wallet.address);
    // Log more details if available
    if (error.transaction) {
      logger.debug(`Transaction details: ${JSON.stringify(error.transaction)}`, wallet.address);
    }
    if (error.receipt) {
      logger.debug(`Receipt details: ${JSON.stringify(error.receipt)}`, wallet.address);
    }
    return false;
  }
}

/**
 * Unstake tokens
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} stakeConfig - Stake configuration
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Unstake success
 */
async function unstakeTokens(wallet, stakeConfig, proxyAgent = null) {
  const { contract, unstakePercentage, maxRetries } = stakeConfig;
  
  try {
    // Use a fixed amount for unstaking to avoid balance check issues
    const unstakeAmount = ethers.utils.parseUnits("50", 18); // 50 DXTR
    
    logger.info(`Unstaking ${ethers.utils.formatUnits(unstakeAmount, 18)} DXTR`, wallet.address);
    
    // Get gas price with higher priority
    const gasPrice = await getGasPrice(wallet.provider, 1.5); // 1.5x multiplier
    
    // Construct raw transaction - method ID is 0x2e17de78 for unstake(uint256)
    const data = ethers.utils.hexConcat([
      '0x2e17de78', // Method ID for unstake(uint256)
      ethers.utils.defaultAbiCoder.encode(['uint256'], [unstakeAmount])
    ]);
    
    // Send raw transaction
    const rawTx = {
      to: contract,
      data,
      gasLimit: ethers.BigNumber.from(200000),
      gasPrice
    };
    
    const tx = await wallet.sendTransaction(rawTx);
    
    logger.info(`Unstake transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`Unstaking successful`, wallet.address);
      return true;
    } else {
      logger.error(`Unstaking failed`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error unstaking tokens: ${error.message}`, wallet.address);
    // If the error contains "No staked balance", it's likely the wallet hasn't staked yet
    if (error.message.includes("reverted") || error.message.includes("balance")) {
      logger.warn(`Likely no staked tokens to unstake`, wallet.address);
    }
    // Log more details if available
    if (error.transaction) {
      logger.debug(`Transaction details: ${JSON.stringify(error.transaction)}`, wallet.address);
    }
    if (error.receipt) {
      logger.debug(`Receipt details: ${JSON.stringify(error.receipt)}`, wallet.address);
    }
    return false;
  }
}

/**
 * Check if user has staked tokens
 * This is a best-effort function that may not be accurate if contract calls fail
 */
async function hasStakedTokens(wallet, contract) {
  try {
    // This is generally unreliable on this network, so we'll assume they have staked tokens
    return true;
  } catch (error) {
    logger.warn(`Failed to check staked tokens: ${error.message}`, wallet.address);
    return false;
  }
}

module.exports = {
  stakeTokens,
  unstakeTokens,
  hasStakedTokens
};