/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextDisplayBuilder,
} = require('discord.js');

const {
  PANEL_COLOR,
} = require('../constants');

const {
  getGuildConfig,
  setGuildConfig,
} = require('../store/configStore');

const PANEL_EDITOR_BUTTON_ID = 'panel-editor:open';
const PANEL_EDITOR_MODAL_ID  = 'panel-editor:modal';

function buildPanelEditorContainerPayload() {
  const container = new ContainerBuilder()
    .setAccentColor(PANEL_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Panel Editor'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(PANEL_EDITOR_BUTTON_ID)
          .setLabel('Open Editor')
          .setStyle(ButtonStyle.Primary),
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

function buildPanelEditorModalPayload(config) {
  return new ModalBuilder()
    .setCustomId(PANEL_EDITOR_MODAL_ID)
    .setTitle('Panel Editor')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(config?.panelTitle ?? 'Get Access'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(
            config?.panelDescription ??
              'Subscribe To The Youtube Channel\nTake A Screen Shot\nClick On Verify Button\nUpload Your Screen Shot',
          ),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('panel_footer')
          .setLabel('Footer')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(config?.panelFooter ?? "If you still don't get access, contact the support team — Built By Arsh"),
      ),
    );
}

module.exports = {
  PANEL_EDITOR_BUTTON_ID,
  PANEL_EDITOR_MODAL_ID,
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the Panel Editor.')
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildConfig = await getGuildConfig(interaction.guildId);

    await interaction.reply({
      ...buildPanelEditorContainerPayload(guildConfig),
    });
  },

  buildPanelEditorModalPayload,
};
