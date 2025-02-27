/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Sleep for a random duration between min and max seconds
   * @param {number} minSeconds - Minimum seconds to sleep
   * @param {number} maxSeconds - Maximum seconds to sleep
   * @returns {Promise<void>}
   */
  async function randomDelay(minSeconds, maxSeconds) {
    const delayMs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
    await sleep(delayMs);
    return delayMs / 1000; // Return the actual delay in seconds
  }
  
  module.exports = {
    sleep,
    randomDelay
  };