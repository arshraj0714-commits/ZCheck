/*
 * ============================================================
 *  ZCheck Verifier Bot — Integrity Guard
 *  Built By Arsh
 * ============================================================
 *
 * WARNING: Modifying this file or credits.js will break the bot.
 * ============================================================
 */

const crypto = require('crypto');
const { AUTHOR_CREDITS } = require('./credits');

// SHA-256 of the exact AUTHOR_CREDITS string — do not change.
const EXPECTED_HASH = 'c0cbffee4c5cd4343a96e96dd4d273536bc373839eb39d7d2b0af6b602b2183e';

// ANSI cyan color (RGB 0, 200, 255) — ZCheck brand accent
const CYAN = '\x1b[38;2;0;200;255m';
const BOLD = '\x1b[1m';
const RST  = '\x1b[0m';

function checkIntegrity() {
  const actual = crypto.createHash('sha256').update(AUTHOR_CREDITS, 'utf8').digest('hex');

  if (actual === EXPECTED_HASH) return; // all good

  console.error('');
  console.error(`${CYAN}${BOLD}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557${RST}`);
  console.error(`${CYAN}${BOLD}\u2551         ZCheck Verifier \u2014 INTEGRITY VIOLATION             \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563${RST}`);
  console.error(`${CYAN}${BOLD}\u2551                                                          \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551  The Bot's Credits Have Been Tampered With.              \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551  Restore The Original Credits of The Author              \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551  To Start The Bot.                                       \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551                                                          \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551  Author : Arsh                                            \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551  Project: ZCheck                                          \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551  Support: https://discord.gg/NWwZQaFzc5                  \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u2551                                                          \u2551${RST}`);
  console.error(`${CYAN}${BOLD}\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D${RST}`);
  console.error('');

  process.exit(1);
}

module.exports = { checkIntegrity };
