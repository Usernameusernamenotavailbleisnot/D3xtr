const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const logger = require('./logger');

/**
 * Setup a proxy agent based on the proxy string
 * @param {string} proxyString - Proxy string (e.g., "http://user:pass@host:port" or "socks5://user:pass@host:port")
 * @returns {Object|null} - Proxy agent or null if setup fails
 */
async function setupProxy(proxyString) {
  try {
    if (!proxyString) return null;
    
    // Determine proxy type and create appropriate agent
    if (proxyString.startsWith('socks')) {
      return new SocksProxyAgent(proxyString);
    } else {
      return new HttpsProxyAgent(proxyString);
    }
  } catch (error) {
    logger.error(`Failed to setup proxy: ${error.message}`);
    return null;
  }
}

module.exports = {
  setupProxy
};