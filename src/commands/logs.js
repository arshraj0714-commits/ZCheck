/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const { getGuildConfig, setGuildConfig } = require('../store/configStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure a channel where verifier logs will be posted.')
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel for verifier logs.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getGuildConfig(interaction.guildId);

    const isOwnerOrExtra = interaction.user.id === interaction.guild.ownerId || config.extraOwnerIds?.includes(interaction.user.id);
    if (!isOwnerOrExtra) {
      await interaction.reply({
        content: 'Only the server owner or an extra owner can configure logs.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);

    const botMember = await interaction.guild.members.fetchMe();
    const perms = channel.permissionsFor(botMember);
    if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
      await interaction.reply({
        content: 'I need View Channel and Send Messages permission in the selected logs channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await setGuildConfig(interaction.guildId, {
      ...config,
      logsChannelId: channel.id,
      updatedAt: new Date().toISOString(),
      updatedBy: interaction.user.id,
    });

    await interaction.reply({
      content: `Logs channel set to: ${channel}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

