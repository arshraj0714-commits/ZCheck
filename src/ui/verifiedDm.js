/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const {
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
} = require('discord.js');

/**
 * Build the DM sent to a user after they pass verification.
 *
 * @param {object} opts
 * @param {string} opts.roleName    - Name of the role that was assigned
 * @param {string} opts.channelName - YouTube channel name/title
 */
function buildVerifiedDmPayload({ roleName, channelName }) {
  const container = new ContainerBuilder()
    .setAccentColor(0x57f287)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `\uD83C\uDF89 You have been verified and received the **${roleName}** role.\n` +
        `-# Thanks for subscribing to **${channelName}**.\n` +
        `-# ZCheck \u00B7 Built By Arsh`,
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

module.exports = { buildVerifiedDmPayload };
