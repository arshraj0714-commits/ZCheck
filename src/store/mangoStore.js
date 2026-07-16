/*
 * ============================================================
 *  ZCheck Verifier Bot — MongoDB Config Store
 *  Built By Arsh
 * ============================================================
 *
 *  Uses the official `mongodb` driver (no mongoose needed).
 *  - One collection: `guild_configs`
 *  - One document per guild, keyed by _id = guildId
 *  - All ZCheck fields stored natively (arrays, objects, strings)
 *  - Works with MongoDB Atlas (mongodb+srv://...) or self-hosted MongoDB
 * ============================================================
 */

const { MongoClient } = require('mongodb');

let client = null;
let collection = null;
let connecting = null;

/**
 * Lazily connect to MongoDB and return the guild_configs collection.
 * Subsequent calls reuse the cached client/collection.
 */
async function getCollection() {
  if (collection) return collection;
  if (connecting) await connecting;

  connecting = (async () => {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error('DATABASE_URL is not set');

    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    });

    await client.connect();

    const dbName = extractDbName(uri) ?? 'zcheck';
    const db = client.db(dbName);
    collection = db.collection('guild_configs');

    await collection.createIndex({ _id: 1 });

    console.log(`[mongoStore] Connected to database "${dbName}", collection "guild_configs"`);
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }

  return collection;
}

/**
 * Extract the database name from a MongoDB URI.
 *   mongodb+srv://user:pass@host/dbname?params  ->  "dbname"
 *   mongodb://user:pass@host:port/dbname?params ->  "dbname"
 *   mongodb://user:pass@host:port/              ->  null  (default to "zcheck")
 */
function extractDbName(uri) {
  try {
    const noParams = uri.split('?')[0];
    const lastSlash = noParams.lastIndexOf('/');
    if (lastSlash === -1) return null;
    const dbPart = noParams.slice(lastSlash + 1).trim();
    return dbPart || null;
  } catch {
    return null;
  }
}

/**
 * Health check — called from index.js before the bot goes online.
 * Ensures the cluster is reachable AND the collection exists.
 */
async function testConnection() {
  const coll = await getCollection();
  // A harmless findOne with a limit forces a real round-trip to the cluster.
  await coll.findOne({}, { limit: 1 });
}

function normalizeGuildConfig(doc = {}) {
  if (!doc) doc = {};
  return {
    guildId:              doc._id                          ?? doc.guildId              ?? null,
    extraOwnerIds:        toStringArray(doc.extraOwnerIds),
    youtubeHandle:        doc.youtubeHandle                ?? null,
    youtubeTitle:         doc.youtubeTitle                 ?? null,
    youtubeChannelId:     doc.youtubeChannelId             ?? null,
    youtubeCanonicalUrl:  doc.youtubeCanonicalUrl          ?? null,
    roleId:               doc.roleId                       ?? null,
    unverifiedRoleId:     doc.unverifiedRoleId             ?? null,
    panelChannelId:       doc.panelChannelId               ?? null,
    panelMessageId:       doc.panelMessageId               ?? null,
    accessChannelId:      doc.accessChannelId              ?? null,
    supportPingRoleIds:   toStringArray(doc.supportPingRoleIds),
    panelTitle:           doc.panelTitle                   ?? null,
    panelDescription:     doc.panelDescription             ?? null,
    panelFooter:          doc.panelFooter                  ?? null,
    logsChannelId:        doc.logsChannelId                ?? null,
    openTickets:          toPlainObject(doc.openTickets),
    ticketChannels:       toPlainObject(doc.ticketChannels),
    updatedAt:            doc.updatedAt                    ?? null,
    updatedBy:            doc.updatedBy                    ?? null,
    referenceChannelData: toPlainObjectOrNull(doc.referenceChannelData),
    referenceImageData:   doc.referenceImageData           ?? null,
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

/**
 * Strip guildId from the document before insert — we use _id as the key.
 */
function toMongoDoc(normalized) {
  const { guildId, ...rest } = normalized;
  return { _id: guildId, ...rest };
}

async function getGuildConfig(guildId) {
  const coll = await getCollection();
  const doc = await coll.findOne({ _id: String(guildId) });
  return normalizeGuildConfig(doc ?? { _id: String(guildId) });
}

async function setGuildConfig(guildId, config) {
  const coll = await getCollection();
  const normalized = normalizeGuildConfig({ ...config, _id: String(guildId) });
  const doc = toMongoDoc(normalized);

  await coll.updateOne(
    { _id: String(guildId) },
    { $set: doc },
    { upsert: true },
  );

  return getGuildConfig(guildId);
}

async function updateGuildConfig(guildId, updater) {
  const current = await getGuildConfig(guildId);
  const next    = await updater(current);
  return setGuildConfig(guildId, next ?? current);
}

module.exports = { getGuildConfig, setGuildConfig, updateGuildConfig, testConnection };
