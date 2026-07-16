// Config store — flat-file (no database).
// Guild configs are stored in data/config.json under the bot's working directory.

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
