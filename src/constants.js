const path = require('node:path');

const DATA_DIR = path.join(process.cwd(), 'data');

// ── ZCheck pre-configured server (Arsh's server) ─────────────────────────────
// These IDs are baked in so the bot auto-configures itself when it joins this
// specific guild. The /setup command can still be run to upload the reference
// screenshot — the values below are used as defaults for the panel channel,
// access channel, verified role, and unverified role.
const ZCHECK_GUILD_ID         = '1167852560602902528';
const ZCHECK_OWNER_ID         = '1498693593701945374';
const ZCHECK_PANEL_CHANNEL_ID = '1527279753546043513'; // verification channel (paste proof here)
const ZCHECK_ACCESS_CHANNEL_ID = '1527276336383656007'; // get-access channel
const ZCHECK_VERIFIED_ROLE_ID   = '1527281571831353436';
const ZCHECK_UNVERIFIED_ROLE_ID = '1527280463427801119';
const ZCHECK_YOUTUBE_HANDLE     = '@RBLXARSH';
const ZCHECK_YOUTUBE_URL        = 'https://www.youtube.com/@RBLXARSH';
const ZCHECK_SUPPORT_INVITE     = 'https://discord.gg/NWwZQaFzc5';

module.exports = {
  CLIENT_ID: process.env.CLIENT_ID,
  TOKEN: process.env.DISCORD_TOKEN,
  CLOSE_INQUIRY_BUTTON_ID: 'support-inquiry:close',
  CONFIG_PATH: path.join(DATA_DIR, 'config.json'),
  CONTACT_SUPPORT_BUTTON_ID: 'support-inquiry:open',
  DATA_DIR,
  MAX_SCREENSHOT_BYTES: 10 * 1024 * 1024,
  // ZCheck brand accent — vivid cyan
  PANEL_COLOR: 0x00C8FF,
  SCREENSHOT_UPLOAD_ID: 'youtube-screenshot',
  VERIFY_BUTTON_ID: 'yt-subscribe-verify:start',
  VERIFY_MODAL_ID: 'yt-subscribe-verify:upload',
  // Pre-configured server constants
  ZCHECK_GUILD_ID,
  ZCHECK_OWNER_ID,
  ZCHECK_PANEL_CHANNEL_ID,
  ZCHECK_ACCESS_CHANNEL_ID,
  ZCHECK_VERIFIED_ROLE_ID,
  ZCHECK_UNVERIFIED_ROLE_ID,
  ZCHECK_YOUTUBE_HANDLE,
  ZCHECK_YOUTUBE_URL,
  ZCHECK_SUPPORT_INVITE,
};
