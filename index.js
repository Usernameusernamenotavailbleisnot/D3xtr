const fs = require('fs');
const yaml = require('js-yaml');
const { ethers } = require('ethers');
const figlet = require('figlet');
const gradient = require('gradient-string');
const cron = require('node-cron');

// Import utilities
const logger = require('./utils/logger');
const { randomDelay } = require('./utils/delay');
const { setupProxy } = require('./utils/proxy');

// Import services
const { registerUser } = require('./services/registration');
const { claimAllFaucets } = require('./services/faucet');
const { depositTokens } = require('./services/deposit');
const { stakeTokens, unstakeTokens } = require('./services/stake');
const { executeTrades } = require('./services/trading');
const { addAllLiquidity } = require('./services/liquidity');

// Load configuration
let config;
try {
  const configFile = fs.readFileSync('./config.yaml', 'utf8');
  config = yaml.load(configFile);
  // Make config globally accessible
  global.config = config;
} catch (error) {
  console.error('Failed to load configuration:', error.message);
  process.exit(1);
}

// Load private keys
let privateKeys = [];
try {
  if (fs.existsSync(config.bot.privateKeyPath)) {
    privateKeys = fs.readFileSync(config.bot.privateKeyPath, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } else {
    logger.error(`Private key file not found: ${config.bot.privateKeyPath}`);
    process.exit(1);
  }
} catch (error) {
  logger.error(`Failed to load private keys: ${error.message}`);
  process.exit(1);
}

// Load proxies if enabled
let proxies = [];
if (config.bot.useProxy) {
  try {
    if (fs.existsSync(config.bot.proxyPath)) {
      proxies = fs.readFileSync(config.bot.proxyPath, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } else {
      logger.warn(`Proxy file not found: ${config.bot.proxyPath}`);
      logger.warn('Running without proxies');
    }
  } catch (error) {
    logger.error(`Failed to load proxies: ${error.message}`);
    logger.warn('Running without proxies');
  }
}

// Display ASCII art header
function displayHeader() {
    // Only display DEXTR with ANSI Shadow font and rainbow gradient
    console.log(gradient.rainbow(figlet.textSync('DEXTR', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    })));
    
    console.log('\n');
  }
// Main function to run the bot for a single wallet
async function runBotForWallet(privateKey, proxy = null) {
  // Connect to the provider
  const provider = new ethers.providers.JsonRpcProvider(config.network.rpc);
  
  // Create wallet instance
  const wallet = new ethers.Wallet(privateKey, provider);
  const walletAddress = wallet.address;
  
  // Setup proxy if provided
  let proxyAgent = null;
  if (proxy) {
    proxyAgent = await setupProxy(proxy);
  }
  
  // Log wallet info (masking private key)
  const maskedAddress = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  logger.info(`Starting operations for wallet ${maskedAddress}`, walletAddress);
  
  try {
    // Register user if needed
    await registerUser(wallet, proxyAgent);
    
    // Claim faucets
    if (config.faucet.enabled) {
      logger.info(`Claiming faucets for ${maskedAddress}`, walletAddress);
      await claimAllFaucets(wallet, config.faucet, proxyAgent);
      
      // Wait for faucet tokens to be received
      logger.info(`Waiting for faucet tokens to be credited for ${maskedAddress}`, walletAddress);
      await randomDelay(config.faucet.delayMin, config.faucet.delayMax);
    }
    
    // Deposit tokens
    if (config.deposit.enabled) {
      for (let i = 0; i < config.deposit.iterations; i++) {
        logger.info(`Deposit iteration ${i + 1}/${config.deposit.iterations} for ${maskedAddress}`, walletAddress);
        // Pass config as an additional parameter
        await depositTokens(wallet, config.deposit, proxyAgent);
        
        if (i < config.deposit.iterations - 1) {
          await randomDelay(config.deposit.delayMin, config.deposit.delayMax);
        }
      }
    }
    
    // Stake tokens
    if (config.stake.enabled) {
      for (let i = 0; i < config.stake.iterations; i++) {
        logger.info(`Stake iteration ${i + 1}/${config.stake.iterations} for ${maskedAddress}`, walletAddress);
        await stakeTokens(wallet, config.stake, proxyAgent);
        
        await randomDelay(config.stake.delayMin, config.stake.delayMax);
        
        logger.info(`Unstake iteration ${i + 1}/${config.stake.iterations} for ${maskedAddress}`, walletAddress);
        await unstakeTokens(wallet, config.stake, proxyAgent);
        
        if (i < config.stake.iterations - 1) {
          await randomDelay(config.stake.delayMin, config.stake.delayMax);
        }
      }
    }
    
    // Execute trades
    if (config.trade.enabled) {
      for (let i = 0; i < config.trade.iterations; i++) {
        logger.info(`Trade iteration ${i + 1}/${config.trade.iterations} for ${maskedAddress}`, walletAddress);
        await executeTrades(wallet, config.trade, proxyAgent);
        
        if (i < config.trade.iterations - 1) {
          await randomDelay(config.trade.delayMin, config.trade.delayMax);
        }
      }
    }
    
    // Add liquidity
    if (config.liquidity && config.liquidity.enabled) {
      for (let i = 0; i < config.liquidity.iterations; i++) {
        logger.info(`Add liquidity iteration ${i + 1}/${config.liquidity.iterations} for ${maskedAddress}`, walletAddress);
        await addAllLiquidity(wallet, config.liquidity, proxyAgent);
        
        if (i < config.liquidity.iterations - 1) {
          await randomDelay(config.liquidity.delayMin, config.liquidity.delayMax);
        }
      }
    }
    
    logger.success(`All operations completed for ${maskedAddress}`, walletAddress);
  } catch (error) {
    logger.error(`Error running bot for ${maskedAddress}: ${error.message}`, walletAddress);
  }
}

// Main function to run the bot for all wallets
async function main() {
  displayHeader();
  
  logger.info(`Starting Dextr Exchange Bot with ${privateKeys.length} wallets`);
  
  // Match proxies with private keys
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    const proxy = i < proxies.length ? proxies[i] : null;
    
    await runBotForWallet(privateKey, proxy);
    
    // Add delay between wallets
    if (i < privateKeys.length - 1) {
      await randomDelay(config.bot.defaultDelayMin, config.bot.defaultDelayMax);
    }
  }
  
  logger.success('All wallet operations completed');
  
  // Schedule the next run (after 25 hours)
  const hourDelay = config.bot.runningDelay / (60 * 60 * 1000);
  logger.info(`Scheduling next run in ${hourDelay.toFixed(2)} hours`);
  
  // Use setTimeout instead of cron for a one-time run after delay
  setTimeout(() => {
    logger.info('Starting next scheduled run');
    main();
  }, config.bot.runningDelay);
}

// Start the bot
main().catch(error => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});