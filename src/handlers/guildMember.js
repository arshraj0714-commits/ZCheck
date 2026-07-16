/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const { PermissionFlagsBits } = require('discord.js');
const { getGuildConfig } = require('../store/configStore');
const { buildWelcomeDmPayload } = require('../ui/welcomeDm');
const {
  ZCHECK_GUILD_ID,
  ZCHECK_UNVERIFIED_ROLE_ID,
} = require('../constants');

/**
 * Fired when a new member joins a guild.
 *
 * For Arsh's ZCheck server (and any server that has configured an
 * unverified role), the member is immediately given the unverified role.
 * A welcome DM is also sent if the server has been set up with a panel channel.
 */
async function handleGuildMemberAdd(member) {
  try {
    if (!member.guild) return;

    const config = await getGuildConfig(member.guild.id);

    // ── Auto-assign unverified role ──────────────────────────────────────────
    // Priority:
    //   1. config.unverifiedRoleId (if set via /setup)
    //   2. Hardcoded ZCHECK_UNVERIFIED_ROLE_ID if this is Arsh's guild
    const unverifiedRoleId =
      config.unverifiedRoleId ??
      (member.guild.id === ZCHECK_GUILD_ID ? ZCHECK_UNVERIFIED_ROLE_ID : null);

    if (unverifiedRoleId) {
      try {
        const botMember = await member.guild.members.fetchMe().catch(() => null);
        const canManageRoles = botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) &&
          botMember.roles.highest.comparePositionTo(member.guild.roles.cache.get(unverifiedRoleId) ?? botMember.roles.highest) > 0;

        if (canManageRoles) {
          await member.roles.add(unverifiedRoleId, 'Auto-assigned unverified role on join (ZCheck)');
        } else {
          console.warn(`[guildMemberAdd] Cannot assign unverified role ${unverifiedRoleId} — missing permissions or role too high.`);
        }
      } catch (err) {
        console.warn(`[guildMemberAdd] Failed to assign unverified role:`, err?.message ?? err);
      }
    }

    // ── Send welcome DM ──────────────────────────────────────────────────────
    if (!config.panelChannelId) return;
    if (!config.referenceImageData && !config.youtubeHandle) return;

    const guildIconUrl =
      member.guild.iconURL({ size: 256, extension: 'png' }) ?? null;

    const payload = buildWelcomeDmPayload({
      config,
      guildId: member.guild.id,
      guildIconUrl,
    });

    const dmChannel = await member.createDM().catch(() => null);
    if (!dmChannel) return;

    await dmChannel.send(payload).catch(() => null);
  } catch {
    // DM failures are non-fatal — the user may have DMs disabled
  }
}

module.exports = { handleGuildMemberAdd };
