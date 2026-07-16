/*
 * ============================================================
 *  ZCheck Verifier Bot — Logger
 *  Built By Arsh
 * ============================================================
 */

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const { getGuildConfig } = require('../store/configStore');

function parseLogMessage(message) {
  const msg = String(message);

  if (msg.includes('button clicked')) {
    const user = msg.match(/by (.+?) \(/)?.[1] ?? 'Unknown';
    const id = msg.match(/\((\d+)\)/)?.[1] ?? '?';
    return {
      icon: '🔔',
      title: 'Verify Button Clicked',
      color: 0x5865f2,
      fields: [
        { label: 'User', value: `${user} (\`${id}\`)` },
      ],
    };
  }

  if (msg.includes('modal submitted')) {
    const user = msg.match(/by (.+?) \(/)?.[1] ?? 'Unknown';
    const id = msg.match(/\((\d+)\)/)?.[1] ?? '?';
    const ok = msg.includes('ok=true');
    const reason = msg.match(/reason=(\S+)/)?.[1] ?? 'unknown';
    return {
      icon: ok ? '✅' : '❌',
      title: ok ? 'Verification Passed' : 'Verification Failed',
      color: ok ? 0x57f287 : 0xed4245,
      fields: [
        { label: 'User', value: `${user} (\`${id}\`)` },
        { label: 'Result', value: ok ? 'Passed' : `Failed — \`${reason}\`` },
      ],
    };
  }

  if (msg.includes('role assigned')) {
    const user = msg.match(/to (.+?) \(/)?.[1] ?? 'Unknown';
    const id = msg.match(/\((\d+)\)/)?.[1] ?? '?';
    const role = msg.match(/role=(\S+)/)?.[1] ?? '?';
    return {
      icon: '🎉',
      title: 'Role Assigned',
      color: 0x57f287,
      fields: [
        { label: 'User', value: `${user} (\`${id}\`)` },
        { label: 'Role', value: `<@&${role}>` },
      ],
    };
  }

  return {
    icon: '📋',
    title: 'Bot Log',
    color: 0x2f3136,
    fields: [{ label: 'Message', value: msg.slice(0, 500) }],
  };
}

async function logToGuildChannel(client, guildId, message) {
  try {
    const config = await getGuildConfig(guildId);
    const logsChannelId = config.logsChannelId;
    if (!logsChannelId) return;

    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) return;

    const channel =
      guild.channels.cache.get(logsChannelId) ?? (await guild.channels.fetch(logsChannelId).catch(() => null));
    if (!channel) return;

    if (typeof channel.send !== 'function') return;

    const parsed = parseLogMessage(message);
    const timestamp = Math.floor(Date.now() / 1000);

    const fieldsText = parsed.fields
      .map((f) => `**${f.label}:** ${f.value}`)
      .join('\n');

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${parsed.icon}  **${parsed.title}**  ·  <t:${timestamp}:T>`,
        ),
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
          .setDivider(true),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(fieldsText),
      );

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => null);
  } catch {
    // no-op logging failures
  }
}

module.exports = {
  logToGuildChannel,
};
