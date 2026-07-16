// Config store — MongoDB when DATABASE_URL is set, flat-file fallback otherwise.
// The active backend is printed at startup so you always know which one is in use.

let impl;

if (process.env.DATABASE_URL) {
  // Prefer MongoDB — this is the production path.
  // If the module fails to load (missing 'mongodb', bad URI, etc.) throw immediately
  // rather than silently falling back to a flat file with no data.
  try {
    impl = require('./mongoStore');
    console.log('[configStore] Backend: MongoDB (DATABASE_URL is set)');
  } catch (e) {
    console.error('[configStore] FATAL: DATABASE_URL is set but mongoStore failed to load.', e);
    throw e;
  }
} else {
  console.warn('[configStore] WARNING: DATABASE_URL is not set — using flat-file config store.');
  console.warn('[configStore] Guild settings WILL be lost on restart unless you set DATABASE_URL.');
}

if (impl) {
  module.exports = {
    getGuildConfig:    impl.getGuildConfig,
    setGuildConfig:    impl.setGuildConfig,
    updateGuildConfig: impl.updateGuildConfig,
    testConnection:    impl.testConnection,
  };
} else {
  // ── Flat-file fallback (no DATABASE_URL) ───────────────────────────────────
  const fs           = require('node:fs/promises');
  const { CONFIG_PATH, DATA_DIR } = require('../constants');

  let configCache = null;

  async function readConfigs() {
    if (configCache) return configCache;
    try {
      const raw  = await fs.readFile(CONFIG_PATH, 'utf8');
      configCache = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[configStore] Could not read config.json — starting with empty config.', err);
      }
      configCache = {};
    }
    return configCache;
  }

  async function writeConfigs(configs) {
    configCache = configs;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, `${JSON.stringify(configs, null, 2)}\n`, 'utf8');
  }

  async function getGuildConfig(guildId) {
    const configs = await readConfigs();
    return normalizeGuildConfig(configs[guildId]);
  }

  async function setGuildConfig(guildId, guildConfig) {
    const configs   = await readConfigs();
    configs[guildId] = normalizeGuildConfig(guildConfig);
    await writeConfigs(configs);
    return configs[guildId];
  }

  async function updateGuildConfig(guildId, updater) {
    const current = await getGuildConfig(guildId);
    const next    = await updater(current);
    return setGuildConfig(guildId, next ?? current);
  }

  async function testConnection() {
    // File store has no real connection — just verify the data dir is writable.
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  function normalizeGuildConfig(config = {}) {
    return {
      ...config,
      extraOwnerIds:     uniqueStrings(config.extraOwnerIds),
      supportPingRoleIds: uniqueStrings(config.supportPingRoleIds),
      openTickets:       isPlainObject(config.openTickets)    ? config.openTickets    : {},
      ticketChannels:    isPlainObject(config.ticketChannels) ? config.ticketChannels : {},
    };
  }

  function uniqueStrings(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((v) => typeof v === 'string'))];
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  module.exports = { getGuildConfig, setGuildConfig, updateGuildConfig, testConnection };
}
