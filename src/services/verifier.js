/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const { verifyScreenshotAttachment } = require('./verifyScreenshotVision');

async function shutdownVerifier() {
  // Vision-only verification: nothing to shutdown.
}

module.exports = {
  shutdownVerifier,
  verifyScreenshotAttachment,
};
