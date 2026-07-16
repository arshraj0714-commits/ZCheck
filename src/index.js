/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 *  Support: https://discord.gg/NWwZQaFzc5
 * ============================================================
 */

require('dotenv').config({ quiet: true });

// ── Integrity check — must run before anything else ───────────────────────────
const { checkIntegrity } = require('./integrity');
checkIntegrity();

const {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  MessageFlags,
  ActivityType,
} = require('discord.js');
const commands = require('./commands');
const {
  CLIENT_ID,
  CONTACT_SUPPORT_BUTTON_ID,
  CLOSE_INQUIRY_BUTTON_ID,
  TOKEN,
  VERIFY_BUTTON_ID,
  VERIFY_MODAL_ID,
  ZCHECK_SUPPORT_INVITE,
} = require('./constants');
const { handleCloseButton, handleCloseCommand, handleContactSupportButton, cleanupTicketChannel } = require('./handlers/support');
const { handleVerifyButton, handleVerifyModal, shutdownVerifier } = require('./handlers/verification');
const { handleGuildMemberAdd } = require('./handlers/guildMember');
const { PANEL_EDITOR_BUTTON_ID, PANEL_EDITOR_MODAL_ID, buildPanelEditorModalPayload } = require('./commands/panel');
const { safeInteractionReply } = require('./utils/respond');
const { testConnection, getGuildConfig, setGuildConfig } = require('./store/configStore');
const { ensureAllZCheckGuilds, ensureZCheckGuildConfig } = require('./services/autoSetup');

if (!TOKEN) {
  throw new Error('Missing DISCORD_TOKEN in .env');
}

if (!CLIENT_ID) {
  throw new Error('Missing CLIENT_ID in .env');
}

// ── Verify storage backend is reachable before going online ───────────────────
testConnection()
  .then(() => console.log('[storage] Connection OK \u2014 guild configs will persist across restarts.'))
  .catch((err) => {
    console.error('[storage] FATAL: Storage backend is unreachable. Bot will exit to prevent data loss.', err);
    process.exit(1);
  });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commandMap = new Map(commands.map((command) => [command.data.name, command]));

client.once(Events.ClientReady, async () => {
  console.log(`Ready as ${client.user.tag}`);

  // ── ZCheck brand presence ───────────────────────────────────────────────────
  client.user.setPresence({
    activities: [{ name: 'ZCheck \u00B7 Built By Arsh', type: ActivityType.Playing }],
    status: 'online',
  });

  if (client.user.id !== CLIENT_ID) {
    console.warn(`CLIENT_ID does not match the logged-in bot. Expected ${CLIENT_ID}, got ${client.user.id}.`);
  }

  // ── Apply ZCheck pre-configured defaults to Arsh's guild (if present) ───────
  await ensureAllZCheckGuilds({ client, getGuildConfig, setGuildConfig });

  await registerCommandsForGuilds(client.guilds.cache.values());
  console.log('Slash commands registered for current guilds.');
});

client.on(Events.GuildCreate, async (guild) => {
  // Apply ZCheck defaults when joining Arsh's guild
  await ensureZCheckGuildConfig({ client, guildId: guild.id, getGuildConfig, setGuildConfig });
  await registerCommandsForGuilds([guild]);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (command) {
        await command.execute(interaction);
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === VERIFY_BUTTON_ID) {
        await handleVerifyButton(interaction);
        return;
      }

      if (interaction.customId === CONTACT_SUPPORT_BUTTON_ID) {
        await handleContactSupportButton(interaction);
        return;
      }

      if (interaction.customId === CLOSE_INQUIRY_BUTTON_ID) {
        await handleCloseButton(interaction);
        return;
      }

      if (interaction.customId === PANEL_EDITOR_BUTTON_ID) {
        const guildConfig = await getGuildConfig(interaction.guildId);
        await interaction.showModal(buildPanelEditorModalPayload(guildConfig));
        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === VERIFY_MODAL_ID) {
        await handleVerifyModal(interaction);
        return;
      }

      if (interaction.customId === PANEL_EDITOR_MODAL_ID) {
        const guildConfig = await getGuildConfig(interaction.guildId);

        const panelTitle       = interaction.fields.getTextInputValue('panel_title');
        const panelDescription = interaction.fields.getTextInputValue('panel_description');
        const panelFooter      = interaction.fields.getTextInputValue('panel_footer');

        await setGuildConfig(interaction.guildId, {
          ...guildConfig,
          panelTitle,
          panelDescription,
          panelFooter,
          updatedAt: new Date().toISOString(),
          updatedBy: interaction.user.id,
        });

        await interaction.reply({ content: 'Panel text updated.' });
        return;
      }
    }
  } catch (error) {
    console.error(error);
    await safeInteractionReply(interaction, 'Something went wrong while handling that request.');
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleCloseCommand(message);
  } catch (error) {
    console.error(error);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await handleGuildMemberAdd(member);
});

client.on(Events.ChannelDelete, async (channel) => {
  if (channel.guildId) {
    await cleanupTicketChannel(channel.guildId, channel.id).catch(console.error);
  }
});

async function registerCommandsForGuilds(guilds) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = commands.map((command) => command.data.toJSON());

  for (const guild of guilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), { body });
      console.log(`Registered commands for ${guild.name} (${guild.id})`);
    } catch (error) {
      console.error(`Could not register commands for guild ${guild.id}:`, error);
    }
  }
}

process.on('SIGINT', async () => {
  await shutdownVerifier();
  client.destroy();
  process.exit(0);
});

client.login(TOKEN);
