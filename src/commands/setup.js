const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const { buildPanelPayload } = require('../ui/panel');
const { getGuildConfig, setGuildConfig } = require('../store/configStore');
const { analyzeReferenceImage, toDataUrlFromBuffer } = require('../services/geminiVision');
const {
  ZCHECK_GUILD_ID,
  ZCHECK_UNVERIFIED_ROLE_ID,
} = require('../constants');

const SUPPORT_ROLE_OPTIONS = [
  'support_ping_role_1',
  'support_ping_role_2',
  'support_ping_role_3',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create the YouTube subscription verification panel.')
    .setDMPermission(false)
    .addAttachmentOption((option) =>
      option
        .setName('reference_image')
        .setDescription('Your own subscription screenshot — AI uses this as the verification reference.')
        .setRequired(true),
    )
    .addRoleOption((option) =>
      option
        .setName('assigning_role')
        .setDescription('Role to assign after successful verification.')
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('panel_channel')
        .setDescription('Channel where the verification panel will be posted.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addRoleOption((option) =>
      option
        .setName('support_ping_role_1')
        .setDescription('Role to ping and allow into support inquiries.')
        .setRequired(true),
    )
    .addRoleOption((option) =>
      option
        .setName('support_ping_role_2')
        .setDescription('Second support role.')
        .setRequired(true),
    )
    .addRoleOption((option) =>
      option
        .setName('support_ping_role_3')
        .setDescription('Third support role.')
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName('access_channel')
        .setDescription('(Optional) Channel users get access to after being verified.')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addRoleOption((option) =>
      option
        .setName('unverified_role')
        .setDescription('(Optional) Role to give new members on join. Removed after successful verification.')
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildConfig = await getGuildConfig(interaction.guildId);

    if (!canUseSetup(interaction, guildConfig)) {
      await interaction.reply({
        content: 'Only the server owner or an extra owner can use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const referenceAttachment = interaction.options.getAttachment('reference_image', true);
    const role                = interaction.options.getRole('assigning_role', true);
    const panelChannel        = interaction.options.getChannel('panel_channel', true);
    const supportRoles        = getSupportRoles(interaction);
    const accessChannel       = interaction.options.getChannel('access_channel', false);
    const unverifiedRole      = interaction.options.getRole('unverified_role', false);

    // Validate the attachment is an image
    if (!referenceAttachment.contentType?.startsWith('image/')) {
      await interaction.reply({
        content: 'The reference must be an image file (PNG, JPG, or WebP). Please try again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const setupIssue = await validateSetup(interaction, role, panelChannel, supportRoles);
    if (setupIssue) {
      await interaction.reply({ content: setupIssue, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ── Download and store the reference image ─────────────────────────────────
    let referenceImageData = null;
    let referenceChannelData = null;

    try {
      const refResponse = await fetch(referenceAttachment.url);
      if (!refResponse.ok) throw new Error(`HTTP ${refResponse.status}`);

      const refBuffer   = Buffer.from(await refResponse.arrayBuffer());
      referenceImageData = toDataUrlFromBuffer(refBuffer, referenceAttachment.contentType);

      // Analyze the reference image to extract channel identity
      referenceChannelData = await analyzeReferenceImage({ imageDataUrl: referenceImageData });

      if (!referenceChannelData || referenceChannelData.confidence < 50) {
        await interaction.editReply({
          content:
            "I couldn't read the channel information from that image. Please provide a clear screenshot of the YouTube channel page showing the channel name and a **Subscribed** button.",
        });
        return;
      }

      console.log('[setup] Reference analyzed:', JSON.stringify(referenceChannelData));
    } catch (err) {
      console.error('[setup] Failed to process reference image:', err.message);
      await interaction.editReply({
        content: 'Failed to process the reference image. Please try again.',
      });
      return;
    }

    // ── Derive channel identity from analysis ──────────────────────────────────
    const resolvedHandle = referenceChannelData.handle   ?? null;
    const resolvedTitle  = referenceChannelData.channel_name ?? null;

    const nextConfig = {
      ...guildConfig,
      youtubeHandle:        resolvedHandle,
      youtubeTitle:         resolvedTitle,
      youtubeChannelId:     null,
      youtubeCanonicalUrl:  null,
      roleId:               role.id,
      unverifiedRoleId:     unverifiedRole?.id
                            ?? guildConfig.unverifiedRoleId
                            ?? (interaction.guildId === ZCHECK_GUILD_ID ? ZCHECK_UNVERIFIED_ROLE_ID : null),
      panelChannelId:       panelChannel.id,
      accessChannelId:      accessChannel?.id ?? guildConfig.accessChannelId ?? null,
      supportPingRoleIds:   supportRoles.map((r) => r.id),
      referenceImageData,
      referenceChannelData,
      updatedAt:            new Date().toISOString(),
      updatedBy:            interaction.user.id,
    };

    const panelMessage = await upsertPanelMessage(panelChannel, guildConfig.panelMessageId, nextConfig);
    nextConfig.panelMessageId = panelMessage.id;

    await setGuildConfig(interaction.guildId, nextConfig);

    const channelDisplay = resolvedTitle
      ? `**${resolvedTitle}**${resolvedHandle ? ` (${resolvedHandle})` : ''}`
      : resolvedHandle ?? 'the detected channel';

    const accessLine = accessChannel
      ? `\nAccess channel after verification: <#${accessChannel.id}>`
      : '';

    await interaction.editReply({
      content:
        `✅ Panel sent! Verification is now set up.\n` +
        `Channel detected from reference image: ${channelDisplay}\n` +
        `Reference confidence: **${referenceChannelData.confidence}%**${accessLine}`,
    });
  },
};

function canUseSetup(interaction, guildConfig) {
  return (
    interaction.user.id === interaction.guild.ownerId ||
    guildConfig.extraOwnerIds.includes(interaction.user.id)
  );
}

function getSupportRoles(interaction) {
  const roles = SUPPORT_ROLE_OPTIONS
    .map((name) => interaction.options.getRole(name, false))
    .filter(Boolean)
    .filter((r) => r.id !== interaction.guildId);
  return [...new Map(roles.map((r) => [r.id, r])).values()];
}

async function validateSetup(interaction, assignRole, panelChannel, supportRoles) {
  if (assignRole.managed || assignRole.id === interaction.guild.id) {
    return 'That role cannot be assigned by the bot. Choose a normal server role.';
  }

  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return 'I need Manage Roles permission before I can assign the verification role.';
  }
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return 'I need Manage Channels permission before I can create support inquiry channels.';
  }
  if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return 'I need Manage Messages permission before I can pin support inquiry containers.';
  }
  if (botMember.roles.highest.comparePositionTo(assignRole) <= 0) {
    return 'Move my highest role above the role you want me to assign, then run setup again.';
  }

  const channelPermissions = panelChannel.permissionsFor(botMember);
  if (
    !channelPermissions?.has(PermissionFlagsBits.ViewChannel) ||
    !channelPermissions.has(PermissionFlagsBits.SendMessages)
  ) {
    return 'I need permission to view and send messages in the selected panel channel.';
  }

  const unpingableRole = supportRoles.find((r) => !r.mentionable);
  if (unpingableRole && !botMember.permissions.has(PermissionFlagsBits.MentionEveryone)) {
    return `I need Mention Everyone permission to ping ${unpingableRole.name}, or make that role mentionable.`;
  }

  return null;
}

async function upsertPanelMessage(channel, previousMessageId, config) {
  const payload = buildPanelPayload(config);
  if (previousMessageId) {
    const previous = await channel.messages.fetch(previousMessageId).catch(() => null);
    if (previous) return previous.edit(payload);
  }
  return channel.send(payload);
}
