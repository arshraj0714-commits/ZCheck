const {
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { SCREENSHOT_UPLOAD_ID } = require('../constants');
const { ZCHECK_GUILD_ID, ZCHECK_UNVERIFIED_ROLE_ID } = require('../constants');
const { getGuildConfig } = require('../store/configStore');
const { buildUploadModal } = require('../ui/uploadModal');
const { buildVerifiedDmPayload } = require('../ui/verifiedDm');
const { shutdownVerifier, verifyScreenshotAttachment } = require('../services/verifier');
const { logToGuildChannel } = require('../utils/logger');

const VERIFY_BUTTON_COOLDOWN_MS = 20_000;
const verifyButtonCooldownByUser = new Map();

/** True if the guild has been set up (reference image OR legacy handle present). */
function isSetUp(config) {
  return !!(config.referenceImageData || config.youtubeHandle);
}

/** Display name used in the upload modal and log messages. */
function channelDisplayName(config) {
  return config.youtubeTitle
    || config.youtubeHandle
    || (config.referenceChannelData?.channel_name)
    || 'the channel';
}

async function handleVerifyButton(interaction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'This verifier only works inside a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const now    = Date.now();
  const userId = interaction.user.id;
  const cooldownUntil = verifyButtonCooldownByUser.get(userId) ?? 0;

  if (cooldownUntil > now) {
    const secs = Math.ceil((cooldownUntil - now) / 1000);
    await interaction.reply({
      content: `Hold on! You're way too fast, wait ${secs} second${secs !== 1 ? 's' : ''}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  verifyButtonCooldownByUser.set(userId, now + VERIFY_BUTTON_COOLDOWN_MS);

  const config = await getGuildConfig(interaction.guildId);

  if (!isSetUp(config)) {
    await interaction.reply({
      content: 'This server has not been set up yet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.channelId !== config.panelChannelId) {
    await interaction.reply({
      content: 'Use the verification panel in the configured channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.showModal(buildUploadModal(channelDisplayName(config)));

  await logToGuildChannel(
    interaction.client,
    interaction.guildId,
    `[verify] button clicked by ${interaction.user.tag} (${interaction.user.id}) channel=${interaction.channelId}`,
  );
}

async function handleVerifyModal(interaction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'This verifier only works inside a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const config = await getGuildConfig(interaction.guildId);

  if (!isSetUp(config)) {
    await interaction.reply({
      content: 'This server has not been set up yet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const role =
    interaction.guild.roles.cache.get(config.roleId) ??
    (await interaction.guild.roles.fetch(config.roleId).catch(() => null));

  if (!role) {
    await interaction.reply({
      content: 'The configured verification role no longer exists. Ask staff to run setup again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const attachment = interaction.fields.getUploadedFiles(SCREENSHOT_UPLOAD_ID, true).first();
  if (!attachment) {
    await interaction.reply({
      content: 'That upload did not include a supported image attachment. Click Verify and try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await verifyScreenshotAttachment(attachment, config);

  await logToGuildChannel(
    interaction.client,
    interaction.guildId,
    `[verify] modal submitted by ${interaction.user.tag} (${interaction.user.id}) ok=${String(result.ok)} reason=${result.publicReason}`,
  );

  if (!result.ok) {
    const reason = result.publicReason ?? 'not_specified_channel';

    if (reason === 'subscribed_missing' || reason === 'not_subscribed') {
      await interaction.editReply({ content: 'Please Subscribe To The Channel First, And Verify Again.' });
    } else if (reason === 'not_youtube') {
      await interaction.editReply({ content: 'Invalid Image.' });
    } else {
      await interaction.editReply({ content: 'Invalid Channel, Please Subscribe To the Specified Channel' });
    }
    return;
  }

  // ── Verification passed — assign role ──────────────────────────────────────
  const member    = await interaction.guild.members.fetch(interaction.user.id);
  const botMember = await interaction.guild.members.fetchMe();

  if (
    !botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
    botMember.roles.highest.comparePositionTo(role) <= 0
  ) {
    await interaction.editReply({
      content: 'The screenshot verified, but I cannot assign the configured role. Ask staff to check my role permissions.',
    });
    return;
  }

  if (member.roles.cache.has(role.id)) {
    await interaction.editReply({ content: 'You already have the assigned role.' });
    return;
  }

  // ── Assign the verified role ───────────────────────────────────────────────
  await member.roles.add(role, `Verified YouTube subscription screenshot (ZCheck)`);

  // ── Remove the unverified role (ZCheck servers swap roles on success) ──────
  const unverifiedRoleId =
    config.unverifiedRoleId ??
    (interaction.guildId === ZCHECK_GUILD_ID ? ZCHECK_UNVERIFIED_ROLE_ID : null);

  if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
    try {
      await member.roles.remove(unverifiedRoleId, 'Verified \u2014 removing unverified role (ZCheck)');
    } catch (err) {
      console.warn(`[verify] Could not remove unverified role ${unverifiedRoleId}:`, err?.message ?? err);
    }
  }

  await logToGuildChannel(
    interaction.client,
    interaction.guildId,
    `[verify] role assigned to ${interaction.user.tag} (${interaction.user.id}) role=${role.id}`,
  );

  const accessChannelMention = config.accessChannelId
    ? ` You now have access to <#${config.accessChannelId}>.`
    : '';

  await interaction.editReply({
    content: `Success! You Have Been Verified.${accessChannelMention}`,
  });

  // ── DM the user (best-effort) ──────────────────────────────────────────────
  const dmPayload = buildVerifiedDmPayload({
    roleName:    role.name,
    channelName: channelDisplayName(config),
  });

  member.createDM()
    .then((dm) => dm.send(dmPayload))
    .catch(() => null);
}

module.exports = {
  handleVerifyButton,
  handleVerifyModal,
  shutdownVerifier,
};
