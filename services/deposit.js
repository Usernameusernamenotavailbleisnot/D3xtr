const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getGasPrice, estimateGas } = require('../utils/gas');
const { randomDelay } = require('../utils/delay');
const { getTokenBalance } = require('../utils/wallet');

// ABI for token approve and transfer functions
const TOKEN_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];

// ABI for deposit function
const DEPOSIT_ABI = [
  'function deposit(address sender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];

/**
 * Approve token spending by vault
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {string} tokenAddress - Token contract address
 * @param {string} vaultAddress - Vault contract address
 * @param {ethers.BigNumber} amount - Amount to approve
 * @returns {Promise<boolean>} - Approval success
 */
async function approveToken(wallet, tokenAddress, vaultAddress, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, wallet);
  
  try {
    // Get token decimals
    const decimals = await getTokenDecimals(tokenAddress, wallet.provider);
    
    // Find token symbol
    const faucetTokens = global.config && global.config.faucet && global.config.faucet.tokens ? 
      global.config.faucet.tokens : [];
    const tokenConfig = faucetTokens.find(t => t.contract.toLowerCase() === tokenAddress.toLowerCase());
    const symbol = tokenConfig ? tokenConfig.symbol : "token";
    
    logger.info(`Approving ${ethers.utils.formatUnits(amount, decimals)} ${symbol} for vault`, wallet.address);
    
    // Get gas price
    const gasPrice = await getGasPrice(wallet.provider);
    
    // Prepare transaction
    const approveTx = await tokenContract.populateTransaction.approve(vaultAddress, amount);
    
    // Estimate gas
    let gasLimit;
    try {
      gasLimit = await estimateGas(approveTx, wallet);
    } catch (error) {
      logger.warn(`Gas estimation failed for approval, using manual gas limit: ${error.message}`);
      gasLimit = ethers.BigNumber.from(100000);
    }
    
    // Send transaction
    const tx = await tokenContract.approve(vaultAddress, amount, {
      gasLimit,
      gasPrice
    });
    
    logger.info(`${symbol} approval transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`${symbol} approval successful`, wallet.address);
      return true;
    } else {
      logger.error(`${symbol} approval failed`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error approving token: ${error.message}`, wallet.address);
    // Log more details for debugging
    if (error.transaction) {
      logger.debug(`Transaction details: ${JSON.stringify(error.transaction)}`, wallet.address);
    }
    return false;
  }
}

/**
 * Get token decimals
 * @param {string} tokenAddress - Token contract address 
 * @param {ethers.providers.Provider} provider - Provider
 * @returns {Promise<number>} - Token decimals
 */
async function getTokenDecimals(tokenAddress, provider) {
  try {
    const abi = ['function decimals() view returns (uint8)'];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    return await contract.decimals();
  } catch (error) {
    // Default to 18 if we can't get decimals
    logger.warn(`Failed to get token decimals, defaulting to 18: ${error.message}`);
    return 18;
  }
}

/**
 * Deposit tokens into vault
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {string} tokenAddress - Token contract address
 * @param {string} vaultAddress - Vault contract address
 * @param {ethers.BigNumber} amount - Amount to deposit
 * @param {string} symbol - Token symbol for logging
 * @returns {Promise<boolean>} - Deposit success
 */
async function depositToken(wallet, tokenAddress, vaultAddress, amount, symbol) {
  try {
    // Get token decimals
    const decimals = await getTokenDecimals(tokenAddress, wallet.provider);
    
    logger.info(`Depositing ${ethers.utils.formatUnits(amount, decimals)} ${symbol} to vault`, wallet.address);
    
    // Get gas price with higher priority
    const gasPrice = await getGasPrice(wallet.provider, 1.5); // Use 1.5x multiplier
    
    // Prepare raw transaction data - use the correct method ID
    const data = ethers.utils.hexConcat([
      '0x609e7624', // Method ID for deposit(address,uint256)
      ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [wallet.address, amount])
    ]);
    
    // Create raw transaction
    const rawTx = {
      to: vaultAddress,
      data,
      gasLimit: ethers.BigNumber.from(300000),
      gasPrice
    };
    
    // Send raw transaction
    const tx = await wallet.sendTransaction(rawTx);
    
    logger.info(`${symbol} deposit transaction sent: ${tx.hash}`, wallet.address);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logger.success(`${symbol} deposit successful`, wallet.address);
      return true;
    } else {
      logger.error(`${symbol} deposit failed`, wallet.address);
      return false;
    }
  } catch (error) {
    logger.error(`Error depositing ${symbol}: ${error.message}`, wallet.address);
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
 * Deposit all tokens based on configuration
 * @param {ethers.Wallet} wallet - Ethers wallet
 * @param {Object} depositConfig - Deposit configuration
 * @param {Object} proxyAgent - Proxy agent (optional)
 * @returns {Promise<boolean>} - Overall success
 */
async function depositTokens(wallet, depositConfig, proxyAgent = null) {
  const { vaults, percentage, maxRetries } = depositConfig;
  let overallSuccess = true;
  
  // Find matching faucet tokens for each vault
  for (const vault of vaults) {
    try {
      // Find the matching token in config.faucet.tokens
      // Safely access the global config
      const faucetTokens = global.config && global.config.faucet && global.config.faucet.tokens ? 
        global.config.faucet.tokens : [];
      const tokenConfig = faucetTokens.find(t => t.symbol === vault.symbol);
      
      if (!tokenConfig) {
        logger.warn(`No matching token found for vault ${vault.symbol}`, wallet.address);
        continue;
      }
      
      // Get token balance
      const balance = await getTokenBalance(tokenConfig.contract, wallet.address, wallet.provider);
      
      if (balance.isZero()) {
        logger.warn(`No ${vault.symbol} tokens to deposit`, wallet.address);
        continue;
      }
      
      // Get token decimals
      const decimals = await getTokenDecimals(tokenConfig.contract, wallet.provider);
      
      // Calculate amount to deposit based on percentage
      const depositAmount = balance.mul(percentage).div(100);
      
      logger.info(`Depositing ${ethers.utils.formatUnits(depositAmount, decimals)} ${vault.symbol} (${percentage}% of balance)`, wallet.address);
      
      let approveSuccess = false;
      let depositSuccess = false;
      let retries = 0;
      
      while (!approveSuccess && retries < maxRetries) {
        if (retries > 0) {
          logger.info(`Retrying ${vault.symbol} approval (${retries}/${maxRetries})`, wallet.address);
          await randomDelay(2, 5);
        }
        
        approveSuccess = await approveToken(wallet, tokenConfig.contract, vault.contract, depositAmount);
        retries++;
      }
      
      if (!approveSuccess) {
        logger.error(`Failed to approve ${vault.symbol} after ${maxRetries} attempts`, wallet.address);
        overallSuccess = false;
        continue;
      }
      
      // Add small delay between approve and deposit
      await randomDelay(2, 5);
      
      // Reset retries for deposit
      retries = 0;
      
      while (!depositSuccess && retries < maxRetries) {
        if (retries > 0) {
          logger.info(`Retrying ${vault.symbol} deposit (${retries}/${maxRetries})`, wallet.address);
          await randomDelay(2, 5);
        }
        
        depositSuccess = await depositToken(wallet, tokenConfig.contract, vault.contract, depositAmount, vault.symbol);
        retries++;
      }
      
      if (!depositSuccess) {
        logger.error(`Failed to deposit ${vault.symbol} after ${maxRetries} attempts`, wallet.address);
        overallSuccess = false;
      }
      
      // Add delay between tokens
      await randomDelay(depositConfig.delayMin, depositConfig.delayMax);
    } catch (error) {
      logger.error(`Error processing ${vault.symbol} deposit: ${error.message}`, wallet.address);
      overallSuccess = false;
    }
  }
  
  return overallSuccess;
}

module.exports = {
  approveToken,
  depositToken,
  depositTokens
};