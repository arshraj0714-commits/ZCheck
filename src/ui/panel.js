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
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} = require('discord.js');
const {
  CONTACT_SUPPORT_BUTTON_ID,
  PANEL_COLOR,
  VERIFY_BUTTON_ID,
} = require('../constants');

function buildPanelPayload(config) {
  const youtubeUrl =
    config.youtubeCanonicalUrl ||
    (config.youtubeHandle ? `https://www.youtube.com/${config.youtubeHandle}` : null);

  const title = config?.panelTitle ?? 'Get Access';
  const description = config?.panelDescription ?? [
    youtubeUrl
      ? `Subscribe To The [Youtube Channel](${youtubeUrl})`
      : 'Subscribe To The Youtube Channel',
    'Take A Screen Shot',
    'Click On Verify Button',
    'Upload Your Screen Shot',
  ].join('\n');
  const footer = config?.panelFooter ?? 'If you still don\u2019t get access, contact the support team \u2014 Built By Arsh';

  const container = new ContainerBuilder()
    .setAccentColor(PANEL_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title.startsWith('#') ? title : `# ${title}`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        description
          .split('\n')
          .map((line) => {
            const trimmed = String(line ?? '').trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('\u00BB')) return trimmed;
            if (trimmed.startsWith('->')) return trimmed.replace(/^->\s*/, '\u00BB ');
            return `\u00BB ${trimmed}`;
          })
          .join('\n'),
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footer}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(VERIFY_BUTTON_ID)
          .setLabel('Verify')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(CONTACT_SUPPORT_BUTTON_ID)
          .setLabel('Contact Support')
          .setStyle(ButtonStyle.Primary),
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

module.exports = {
  buildPanelPayload,
};
