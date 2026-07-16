/*
 * ============================================================
 *  ZCheck Verifier Bot — Auto Setup
 *  Built By Arsh
 * ============================================================
 *
 * Pre-configures the bot for Arsh's specific Discord server.
 * When the bot joins (or starts up in) the ZCheck guild, the channel IDs,
 * role IDs, and YouTube handle are baked in so the user only has to run
 * /setup once to upload their reference screenshot.
 * ============================================================
 */

const {
  ZCHECK_GUILD_ID,
  ZCHECK_PANEL_CHANNEL_ID,
  ZCHECK_ACCESS_CHANNEL_ID,
  ZCHECK_VERIFIED_ROLE_ID,
  ZCHECK_UNVERIFIED_ROLE_ID,
  ZCHECK_YOUTUBE_HANDLE,
  ZCHECK_YOUTUBE_URL,
  ZCHECK_OWNER_ID,
} = require('../constants');

/**
 * Returns true if the given guild is the pre-configured ZCheck guild.
 */
function isZCheckGuild(guildId) {
  return guildId === ZCHECK_GUILD_ID;
}

/**
 * Returns a partial config object containing all the pre-baked ZCheck defaults
 * for Arsh's server. Existing user-set fields (reference image, panel message
 * id, support roles, panel text, etc.) are preserved.
 */
function buildZCheckDefaults(existingConfig = {}) {
  return {
    ...existingConfig,
    youtubeHandle:       existingConfig.youtubeHandle       ?? ZCHECK_YOUTUBE_HANDLE,
    youtubeCanonicalUrl: existingConfig.youtubeCanonicalUrl ?? ZCHECK_YOUTUBE_URL,
    roleId:              existingConfig.roleId              ?? ZCHECK_VERIFIED_ROLE_ID,
    unverifiedRoleId:    existingConfig.unverifiedRoleId    ?? ZCHECK_UNVERIFIED_ROLE_ID,
    panelChannelId:      existingConfig.panelChannelId      ?? ZCHECK_PANEL_CHANNEL_ID,
    accessChannelId:     existingConfig.accessChannelId     ?? ZCHECK_ACCESS_CHANNEL_ID,
    panelTitle:          existingConfig.panelTitle          ?? 'Get Access',
    panelDescription:    existingConfig.panelDescription    ?? null, // falls back to default in panel.js
    panelFooter:         existingConfig.panelFooter         ?? 'If you still don\u2019t get access, contact the support team \u2014 Built By Arsh',
  };
}

/**
 * Ensures the pre-configured ZCheck guild has all the baked-in defaults.
 * Called on startup and on GuildCreate. Does NOT overwrite fields the admin
 * has already set — only fills in missing ones.
 */
async function ensureZCheckGuildConfig({ client, guildId, getGuildConfig, setGuildConfig }) {
  if (!isZCheckGuild(guildId)) return false;

  const existing = await getGuildConfig(guildId);
  const next     = buildZCheckDefaults(existing);

  // Nothing to do if every default is already set
  const isComplete =
    existing.youtubeHandle       === next.youtubeHandle       &&
    existing.roleId              === next.roleId              &&
    existing.unverifiedRoleId    === next.unverifiedRoleId    &&
    existing.panelChannelId      === next.panelChannelId      &&
    existing.accessChannelId     === next.accessChannelId;

  if (isComplete) return false;

  await setGuildConfig(guildId, {
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: ZCHECK_OWNER_ID,
  });

  console.log(`[zcheck] Auto-configured guild ${guildId} with Arsh's defaults.`);
  return true;
}

/**
 * Sweep all current guilds and apply ZCheck defaults where applicable.
 * Called once on ClientReady.
 */
async function ensureAllZCheckGuilds({ client, getGuildConfig, setGuildConfig }) {
  for (const guild of client.guilds.cache.values()) {
    try {
      await ensureZCheckGuildConfig({ client, guildId: guild.id, getGuildConfig, setGuildConfig });
    } catch (err) {
      console.warn(`[zcheck] Auto-setup failed for guild ${guild.id}:`, err?.message ?? err);
    }
  }
}

module.exports = {
  isZCheckGuild,
  buildZCheckDefaults,
  ensureZCheckGuildConfig,
  ensureAllZCheckGuilds,
};
