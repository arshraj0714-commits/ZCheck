/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const {
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../store/configStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('extraowner')
    .setDescription('Manage users who can run setup.')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Allow a user to run /setup.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to allow.')
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.user.id !== interaction.guild.ownerId) {
      await interaction.reply({
        content: 'Only the server owner can add extra owners.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.options.getSubcommand() !== 'add') {
      await interaction.reply({
        content: 'Unknown extraowner action.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = interaction.options.getUser('user', true);
    const guildConfig = await getGuildConfig(interaction.guildId);

    if (target.id === interaction.guild.ownerId) {
      await interaction.reply({
        content: 'The server owner can already use /setup.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!guildConfig.extraOwnerIds.includes(target.id)) {
      guildConfig.extraOwnerIds.push(target.id);
      await setGuildConfig(interaction.guildId, guildConfig);
    }

    await interaction.reply({
      content: `${target.tag} can now use /setup.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
