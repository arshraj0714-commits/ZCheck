/*
 * ============================================================
 *  ZCheck Verifier Bot — PostgreSQL Config Store
 *  Built By Arsh
 * ============================================================
 */

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testConnection() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  if (rows[0]?.ok !== 1) throw new Error('Unexpected response from PostgreSQL health check');
  await ensureSchema();
}

async function ensureSchema() {
  // Auto-create the guild_configs table if missing, and add any new columns
  // (like unverified_role_id) to existing tables so the bot can self-upgrade.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id              TEXT PRIMARY KEY,
      extra_owner_ids       TEXT[] NOT NULL DEFAULT '{}',
      youtube_handle        TEXT,
      youtube_title         TEXT,
      youtube_channel_id    TEXT,
      youtube_canonical_url TEXT,
      role_id               TEXT,
      unverified_role_id    TEXT,
      panel_channel_id      TEXT,
      panel_message_id      TEXT,
      access_channel_id     TEXT,
      support_ping_role_ids TEXT[] NOT NULL DEFAULT '{}',
      panel_title           TEXT,
      panel_description     TEXT,
      panel_footer          TEXT,
      open_tickets          JSONB NOT NULL DEFAULT '{}',
      ticket_channels       JSONB NOT NULL DEFAULT '{}',
      logs_channel_id       TEXT,
      updated_at            TEXT,
      updated_by            TEXT,
      reference_channel_data JSONB,
      reference_image_data  TEXT
    );
  `);

  // Add unverified_role_id column if it doesn't exist (for upgrades from v1.0)
  await pool.query(`
    ALTER TABLE guild_configs
    ADD COLUMN IF NOT EXISTS unverified_role_id TEXT;
  `).catch(() => null);

  // Add logs_channel_id column if it doesn't exist
  await pool.query(`
    ALTER TABLE guild_configs
    ADD COLUMN IF NOT EXISTS logs_channel_id TEXT;
  `).catch(() => null);
}

function normalizeGuildConfig(row = {}) {
  return {
    guildId:              row.guild_id               ?? row.guildId              ?? null,
    extraOwnerIds:        toStringArray(row.extra_owner_ids      ?? row.extraOwnerIds),
    youtubeHandle:        row.youtube_handle          ?? row.youtubeHandle        ?? null,
    youtubeTitle:         row.youtube_title           ?? row.youtubeTitle         ?? null,
    youtubeChannelId:     row.youtube_channel_id      ?? row.youtubeChannelId     ?? null,
    youtubeCanonicalUrl:  row.youtube_canonical_url   ?? row.youtubeCanonicalUrl  ?? null,
    roleId:               row.role_id                 ?? row.roleId               ?? null,
    unverifiedRoleId:     row.unverified_role_id      ?? row.unverifiedRoleId     ?? null,
    panelChannelId:       row.panel_channel_id        ?? row.panelChannelId       ?? null,
    panelMessageId:       row.panel_message_id        ?? row.panelMessageId       ?? null,
    accessChannelId:      row.access_channel_id       ?? row.accessChannelId      ?? null,
    supportPingRoleIds:   toStringArray(row.support_ping_role_ids ?? row.supportPingRoleIds),
    panelTitle:           row.panel_title             ?? row.panelTitle           ?? null,
    panelDescription:     row.panel_description       ?? row.panelDescription     ?? null,
    panelFooter:          row.panel_footer            ?? row.panelFooter          ?? null,
    logsChannelId:        row.logs_channel_id         ?? row.logsChannelId        ?? null,
    openTickets:          toPlainObject(row.open_tickets    ?? row.openTickets),
    ticketChannels:       toPlainObject(row.ticket_channels ?? row.ticketChannels),
    updatedAt:            row.updated_at              ?? row.updatedAt            ?? null,
    updatedBy:            row.updated_by              ?? row.updatedBy            ?? null,
    referenceChannelData: toPlainObjectOrNull(row.reference_channel_data ?? row.referenceChannelData),
    referenceImageData:   row.reference_image_data    ?? row.referenceImageData   ?? null,
  };
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v) => typeof v === 'string' && v !== ''))];
}

function toPlainObject(value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function toPlainObjectOrNull(value) {
  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) return value;
  return null;
}

async function getGuildConfig(guildId) {
  const { rows } = await pool.query(
    'SELECT * FROM guild_configs WHERE guild_id = $1',
    [guildId],
  );
  return normalizeGuildConfig(rows[0] ?? { guild_id: guildId });
}

async function setGuildConfig(guildId, config) {
  const n = normalizeGuildConfig({ ...config, guildId });

  await pool.query(
    `INSERT INTO guild_configs (
      guild_id, extra_owner_ids, youtube_handle, youtube_title,
      youtube_channel_id, youtube_canonical_url, role_id, unverified_role_id,
      panel_channel_id, panel_message_id, access_channel_id,
      support_ping_role_ids, panel_title, panel_description, panel_footer,
      logs_channel_id, open_tickets, ticket_channels, updated_at, updated_by,
      reference_channel_data, reference_image_data
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    ON CONFLICT (guild_id) DO UPDATE SET
      extra_owner_ids        = EXCLUDED.extra_owner_ids,
      youtube_handle         = EXCLUDED.youtube_handle,
      youtube_title          = EXCLUDED.youtube_title,
      youtube_channel_id     = EXCLUDED.youtube_channel_id,
      youtube_canonical_url  = EXCLUDED.youtube_canonical_url,
      role_id                = EXCLUDED.role_id,
      unverified_role_id     = EXCLUDED.unverified_role_id,
      panel_channel_id       = EXCLUDED.panel_channel_id,
      panel_message_id       = EXCLUDED.panel_message_id,
      access_channel_id      = EXCLUDED.access_channel_id,
      support_ping_role_ids  = EXCLUDED.support_ping_role_ids,
      panel_title            = EXCLUDED.panel_title,
      panel_description      = EXCLUDED.panel_description,
      panel_footer           = EXCLUDED.panel_footer,
      logs_channel_id        = EXCLUDED.logs_channel_id,
      open_tickets           = EXCLUDED.open_tickets,
      ticket_channels        = EXCLUDED.ticket_channels,
      updated_at             = EXCLUDED.updated_at,
      updated_by             = EXCLUDED.updated_by,
      reference_channel_data = EXCLUDED.reference_channel_data,
      reference_image_data   = EXCLUDED.reference_image_data`,
    [
      guildId,
      n.extraOwnerIds,
      n.youtubeHandle,
      n.youtubeTitle,
      n.youtubeChannelId,
      n.youtubeCanonicalUrl,
      n.roleId,
      n.unverifiedRoleId,
      n.panelChannelId,
      n.panelMessageId,
      n.accessChannelId,
      n.supportPingRoleIds,
      n.panelTitle,
      n.panelDescription,
      n.panelFooter,
      n.logsChannelId,
      JSON.stringify(n.openTickets),
      JSON.stringify(n.ticketChannels),
      n.updatedAt,
      n.updatedBy,
      n.referenceChannelData ? JSON.stringify(n.referenceChannelData) : null,
      n.referenceImageData ?? null,
    ],
  );

  return getGuildConfig(guildId);
}

async function updateGuildConfig(guildId, updater) {
  const current = await getGuildConfig(guildId);
  const next    = await updater(current);
  return setGuildConfig(guildId, next ?? current);
}

module.exports = { getGuildConfig, setGuildConfig, updateGuildConfig, testConnection };
