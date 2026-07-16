/*
 * ============================================================
 *  ZCheck Verifier Bot — Support Ticket Handler
 *  Built By Arsh
 * ============================================================
 */

const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../store/configStore');
const { buildTicketPayload } = require('../ui/ticket');
const { logToGuildChannel } = require('../utils/logger');


const USER_TICKET_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

const BOT_TICKET_PERMISSIONS = [
  ...USER_TICKET_PERMISSIONS,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageMessages,
];

function extractOpenerIdFromTopic(topic) {
  if (!topic) return null;
  // topic format: "Support inquiry for ${tag} (${id})"
  const match = String(topic).match(/\((\d{15,})\)/);
  return match?.[1] ?? null;
}

async function handleContactSupportButton(interaction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: 'Support inquiries only work inside a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const config = await getGuildConfig(interaction.guildId);

  if (!config.youtubeHandle) {
    await interaction.reply({
      content: 'This server has not been set up yet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existingChannel = await getExistingTicketChannel(interaction, config);
  if (existingChannel) {
    await interaction.reply({
      content: `You already have an open support inquiry: ${existingChannel}.`,
      flags: MessageFlags.Ephemeral,
    });
    await logToGuildChannel(interaction.client, interaction.guildId, `[support] duplicate contact support click by ${interaction.user.tag} (${interaction.user.id}) existing: ${existingChannel.id}`);
    return;
  }


  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({
      content: 'I need Manage Channels permission to open a support inquiry.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supportRoleIds = getExistingSupportRoleIds(interaction.guild, config.supportPingRoleIds);
  const channel = await createTicketChannel(interaction, botMember, supportRoleIds);

  await updateGuildConfig(interaction.guildId, (guildConfig) => {
    guildConfig.openTickets[interaction.user.id] = channel.id;
    guildConfig.ticketChannels[channel.id] = {
      openerId: interaction.user.id,
      createdAt: new Date().toISOString(),
    };

    // Also stamp channel topic so we can reconstruct on config drift.
    // (We intentionally do not await here.)
    try {
      channel.setTopic?.(`Support inquiry for ${interaction.user.tag} (${interaction.user.id})`);
    } catch {
      // ignore
    }

    return guildConfig;
  });


  if (supportRoleIds.length > 0) {
    await channel.send({
      content: supportRoleIds.map((roleId) => `<@&${roleId}>`).join(' '),
      allowedMentions: { roles: supportRoleIds },
    });
  }

  const ticketMessage = await channel.send(buildTicketPayload(interaction.user));
  await ticketMessage.pin('Support inquiry opened').catch((error) => {
    console.warn(`Could not pin support inquiry message in ${channel.id}:`, error.message);
  });

  await interaction.editReply({
    content: `Your support inquiry has been opened: ${channel}.`,
  });

  await logToGuildChannel(
    interaction.client,
    interaction.guildId,
    `[support] opened by ${interaction.user.tag} (${interaction.user.id}) channel=${channel.id}`,
  );
}


async function handleCloseButton(interaction) {
  if (!interaction.inCachedGuild() || !interaction.channel) {
    await interaction.reply({
      content: 'This can only be used inside a support inquiry channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // If the ticket record is missing (config drift), try to reconstruct from channel topic.
  if (!interaction.channel.topic) {
    // still attempt close logic below; canCloseTicket will handle permission/record checks.
  }

  const config = await getGuildConfig(interaction.guildId);
  if (!config.ticketChannels[interaction.channel.id]) {

    const openerId = extractOpenerIdFromTopic(interaction.channel.topic);
    if (openerId && config.openTickets[openerId] === interaction.channel.id) {
      await updateGuildConfig(interaction.guildId, (guildConfig) => {
        guildConfig.ticketChannels[interaction.channel.id] = {
          openerId,
          createdAt: guildConfig.ticketChannels?.[interaction.channel.id]?.createdAt ?? new Date().toISOString(),
        };
        return guildConfig;
      });
    }
  }

  const result = await canCloseTicket(interaction.guildId, interaction.channel.id, interaction.member);
  if (!result.ok) {
    await interaction.reply({
      content: result.reason,
      flags: MessageFlags.Ephemeral,
    });
    await logToGuildChannel(
      interaction.client,
      interaction.guildId,
      `[support] close denied in channel=${interaction.channel.id} by ${interaction.user.tag} (${interaction.user.id}) reason=${result.reason}`,
    );
    return;
  }


  await interaction.reply({
    content: 'Closing inquiry.',
    flags: MessageFlags.Ephemeral,
  });
  await closeTicketChannel(interaction.channel, interaction.user.tag, interaction.client);
}


async function handleCloseCommand(message) {
  if (message.author.bot || !message.inGuild() || message.content.trim().toLowerCase() !== '-close') {
    return;
  }

  const result = await canCloseTicket(message.guildId, message.channel.id, message.member);
  if (!result.ok) {
    return;
  }

  await message.reply('Closing inquiry.');
  await closeTicketChannel(message.channel, message.author.tag, message.client);
}


async function cleanupTicketChannel(guildId, channelId) {
  await updateGuildConfig(guildId, (guildConfig) => {
    removeTicketRecords(guildConfig, channelId);
    return guildConfig;
  });
}

async function getExistingTicketChannel(interaction, config) {
  const existingId = config.openTickets[interaction.user.id];

  if (!existingId) {
    return null;
  }

  const existingChannel = await interaction.guild.channels.fetch(existingId).catch(() => null);
  if (existingChannel) {
    return existingChannel;
  }

  await cleanupTicketChannel(interaction.guildId, existingId);
  return null;
}

function getExistingSupportRoleIds(guild, roleIds) {
  return roleIds.filter((roleId) => guild.roles.cache.has(roleId));
}

async function createTicketChannel(interaction, botMember, supportRoleIds) {
  const parent = interaction.channel?.parentId ?? undefined;
  const permissionOverwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: USER_TICKET_PERMISSIONS,
    },
    {
      id: botMember.id,
      allow: BOT_TICKET_PERMISSIONS,
    },
    ...supportRoleIds.map((roleId) => ({
      id: roleId,
      allow: USER_TICKET_PERMISSIONS,
    })),
  ];

  return interaction.guild.channels.create({
    name: buildTicketChannelName(interaction.user),
    type: ChannelType.GuildText,
    parent,
    topic: `Support inquiry for ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites,
    reason: `Support inquiry opened by ${interaction.user.tag}`,
  });
}

async function canCloseTicket(guildId, channelId, member) {
  const config = await getGuildConfig(guildId);
  const ticket = config.ticketChannels[channelId];

  if (!ticket) {
    return {
      ok: false,
      reason: 'This is not an open support inquiry channel.',
    };
  }

  if (
    member.id === ticket.openerId ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: 'Only the inquiry owner or server staff can close this inquiry.',
  };
}

async function closeTicketChannel(channel, closedBy, client) {
  await channel.delete(`Support inquiry closed by ${closedBy}`);
  await cleanupTicketChannel(channel.guildId, channel.id);
  await logToGuildChannel(
    client,
    channel.guildId,
    `[support] closed channel=${channel.id} by ${closedBy}`,
  );
}


function removeTicketRecords(guildConfig, channelId) {
  const ticket = guildConfig.ticketChannels[channelId];

  if (ticket?.openerId) {
    delete guildConfig.openTickets[ticket.openerId];
  }

  for (const [userId, openChannelId] of Object.entries(guildConfig.openTickets)) {
    if (openChannelId === channelId) {
      delete guildConfig.openTickets[userId];
    }
  }

  delete guildConfig.ticketChannels[channelId];
}

function buildTicketChannelName(user) {
  const safeName = user.username
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'user';

  return `support-${safeName}-${user.id.slice(-4)}`;
}

module.exports = {
  cleanupTicketChannel,
  handleCloseButton,
  handleCloseCommand,
  handleContactSupportButton,
};

