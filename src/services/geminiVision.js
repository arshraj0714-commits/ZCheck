/*
 * ============================================================
 *  ZCheck Verifier Bot — Groq Vision Service
 *  (was Gemini — switched to Groq's free Llama 4 Scout vision model)
 *  Built By Arsh
 * ============================================================
 *
 *  Uses Groq's OpenAI-compatible Chat Completions API:
 *    POST https://api.groq.com/openai/v1/chat/completions
 *    Authorization: Bearer $GROQ_API_KEY
 *
 *  Get a free API key: https://console.groq.com/keys
 *  Env var: GROQ_API_KEY
 * ============================================================
 */

const GROQ_MODEL    = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a raw Buffer to a base64 data URL.
 */
function toDataUrlFromBuffer(buffer, mimeType = 'image/png') {
  const b64 = Buffer.isBuffer(buffer)
    ? buffer.toString('base64')
    : Buffer.from(buffer).toString('base64');
  return `data:${mimeType};base64,${b64}`;
}

/**
 * Parse a data URL into { mimeType, data } (data = pure base64, no prefix).
 */
function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error(`Invalid data URL (length=${dataUrl?.length})`);
  return { mimeType: match[1], data: match[2] };
}

function parseJson(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/i, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : JSON.parse(cleaned);
}

// ── Core API call ────────────────────────────────────────────────────────────

/**
 * Call Groq with an array of parts (OpenAI-compatible message content format).
 * Each part is one of:
 *   { type: 'text',  text: '...' }
 *   { type: 'image', mimeType: 'image/png', data: '<base64>', url?: '<full data url>' }
 */
async function callGroq(parts) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY environment variable');

  // Build OpenAI-compatible content array
  const content = parts.map((p) => {
    if (p.type === 'text') {
      return { type: 'text', text: p.text };
    }
    if (p.type === 'image') {
      const url = p.url ?? `data:${p.mimeType};base64,${p.data}`;
      return { type: 'image_url', image_url: { url } };
    }
    throw new Error(`Unknown part type: ${p.type}`);
  });

  const res = await fetch(GROQ_ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Groq API ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = await res.json().catch(() => null);
  const rawText = json?.choices?.[0]?.message?.content ?? '';

  if (!rawText) {
    const reason = json?.choices?.[0]?.finish_reason ?? 'unknown';
    throw new Error(`Groq returned empty response (finish_reason=${reason})`);
  }

  return rawText;
}

// ── Reference image analysis (called once at /setup time) ───────────────────

/**
 * Deeply analyze the admin's reference screenshot.
 * Returns a rich visual fingerprint stored in the DB.
 */
async function analyzeReferenceImage({ imageDataUrl }) {
  const { mimeType, data } = parseDataUrl(imageDataUrl);

  const prompt = `You are analyzing a YouTube channel screenshot provided by a server admin.
Extract every visible detail about this channel with maximum precision.

Return ONLY valid JSON — no markdown, no explanation:
{
  "channel_name": "exact channel name as displayed, case-sensitive",
  "handle": "@handle exactly as shown, or null",
  "subscriber_count": "exact subscriber count text visible, or null",
  "profile_description": "describe the profile picture in detail (colors, subject, style)",
  "banner_description": "describe the channel banner, or null if not visible",
  "ui_style": "mobile_app or desktop_browser or unknown",
  "has_subscribed_button": true or false,
  "subscribed_button_style": "describe the exact appearance of the Subscribed button",
  "confidence": 0-100
}

Rules:
- channel_name: copy character-for-character, exact capitalisation
- handle: include the @ symbol, exact match
- has_subscribed_button: true ONLY if a greyed-out/filled/checkmarked Subscribed button is clearly visible
- confidence: how clearly you can read the channel name (0=unreadable, 100=crystal clear)`;

  let contentText;
  try {
    contentText = await callGroq([
      { type: 'text',  text: prompt },
      { type: 'image', mimeType, data },
    ]);
  } catch (err) {
    console.error('[analyzeReferenceImage] Groq error:', err.message);
    return null;
  }

  console.log('[analyzeReferenceImage] raw output:', contentText?.slice(0, 600));

  try {
    const d = parseJson(contentText);
    return {
      channel_name:           d.channel_name           ?? null,
      handle:                 d.handle                 ?? null,
      subscriber_count:       d.subscriber_count       ?? null,
      profile_description:    d.profile_description    ?? null,
      banner_description:     d.banner_description     ?? null,
      ui_style:               d.ui_style               ?? 'unknown',
      has_subscribed_button:  !!d.has_subscribed_button,
      subscribed_button_style: d.subscribed_button_style ?? null,
      confidence:             Number(d.confidence)     || 0,
      analyzed_at:            new Date().toISOString(),
    };
  } catch {
    console.warn('[analyzeReferenceImage] JSON parse failed:', contentText?.slice(0, 200));
    return null;
  }
}

// ── User screenshot verification (TWO-IMAGE direct comparison) ───────────────

/**
 * Verify a user's screenshot by directly comparing it against the admin's
 * reference image. Groq sees BOTH images in a single request — no text
 * intermediary — giving the highest possible visual accuracy.
 */
async function verifyScreenshotWithGemini({
  referenceImageData,
  userImageDataUrl,
  referenceChannelData,
  youtubeHandle,
  youtubeTitle,
}) {
  if (!process.env.GROQ_API_KEY) {
    return { ok: false, publicReason: 'missing_gemini_key' };
  }

  // ── Build identity block from reference data ────────────────────────────
  const refName   = referenceChannelData?.channel_name ?? youtubeTitle  ?? null;
  const refHandle = referenceChannelData?.handle       ?? youtubeHandle ?? null;

  if (!refName && !refHandle && !referenceImageData) {
    return { ok: false, publicReason: 'wrong_channel' };
  }

  const identityLines = [];
  if (refName)   identityLines.push(`Channel Name (EXACT): "${refName}"`);
  if (refHandle) identityLines.push(`Handle (EXACT):       "${refHandle}"`);
  if (referenceChannelData?.subscriber_count)
    identityLines.push(`Subscriber Count: ${referenceChannelData.subscriber_count}`);
  if (referenceChannelData?.profile_description)
    identityLines.push(`Profile Picture: ${referenceChannelData.profile_description}`);

  const identityBlock = identityLines.length
    ? `\nKnown channel details extracted from reference:\n${identityLines.map((l) => `  • ${l}`).join('\n')}`
    : '';

  const prompt = `You are a STRICT YouTube Subscription Verifier for a Discord server.

Image 1 is the REFERENCE screenshot — the admin's own subscription screenshot showing the correct channel.
Image 2 is the USER screenshot — submitted by a member claiming to be subscribed.${identityBlock}

YOUR TASK: Does Image 2 show the user subscribed to EXACTLY the same YouTube channel as Image 1?

MATCHING RULES (channel_match = true) — ALL must be true:
• The channel name in Image 2 EXACTLY matches Image 1 (same spelling, same capitalisation)
• The handle in Image 2 EXACTLY matches Image 1 (if visible)
• The profile picture/avatar in Image 2 matches Image 1
• Any other channel, different creator, or unrelated page = FAIL

SUBSCRIPTION RULES (subscription_status = "subscribed") — ALL must be true:
• A grey/filled/checkmarked "Subscribed" button is clearly visible in Image 2
• A red "Subscribe" button = NOT subscribed = FAIL
• No button visible = FAIL

AUTHENTICITY RULES (ui_authenticity = "authentic") — ALL must be true:
• Image 2 is clearly a real YouTube website or app screenshot
• No signs of editing, Photoshop, HTML injection, or AI generation
• Image is not cropped, blurry, or obfuscated

VERIFIED = true ONLY when ALL three pass AND confidence >= 85.
ANY doubt = verified: false.

Return ONLY valid JSON — no markdown, no explanation:
{"verified": true or false, "confidence": 0-100, "channel_detected": "exact name read from Image 2 or Unknown", "channel_match": true or false, "subscription_status": "subscribed or not_subscribed or unknown", "ui_authenticity": "authentic or suspicious or manipulated", "fraud_score": 0-100, "reason": "one concise sentence"}`;

  // ── Build parts list ─────────────────────────────────────────────────────
  const parts = [];

  // Image 1: reference (if stored)
  if (referenceImageData) {
    try {
      const ref = parseDataUrl(referenceImageData);
      parts.push({ type: 'text',  text: 'Image 1 — REFERENCE (admin subscription screenshot):' });
      parts.push({ type: 'image', mimeType: ref.mimeType, data: ref.data });
    } catch (e) {
      console.warn('[verifyScreenshot] Could not parse reference image:', e.message);
    }
  }

  // Image 2: user screenshot
  const user = parseDataUrl(userImageDataUrl);
  parts.push({ type: 'text',  text: referenceImageData ? 'Image 2 — USER screenshot to verify:' : 'User screenshot to verify:' });
  parts.push({ type: 'image', mimeType: user.mimeType, data: user.data });

  // Prompt at the end so the model has full image context first
  parts.push({ type: 'text', text: prompt });

  let contentText;
  try {
    contentText = await callGroq(parts);
  } catch (fetchErr) {
    console.error('[verifyScreenshot] Groq error:', fetchErr?.message ?? fetchErr);
    return { ok: false, publicReason: 'vision_service_error' };
  }

  console.log('[verifyScreenshot] model output:', contentText?.slice(0, 600));

  let extracted;
  try {
    extracted = parseJson(contentText);
  } catch {
    console.warn('[verifyScreenshot] JSON parse failed:', contentText?.slice(0, 300));
    return { ok: false, publicReason: 'not_youtube' };
  }

  function strictBool(val) {
    if (val === true || val === false) return val;
    if (typeof val === 'string') {
      const l = val.toLowerCase();
      if (l === 'true')  return true;
      if (l === 'false') return false;
    }
    return false;
  }

  function toNum(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  const verified       = strictBool(extracted.verified);
  const confidence     = toNum(extracted.confidence, 0);
  const channelMatch   = strictBool(extracted.channel_match);
  const subStatus      = (extracted.subscription_status ?? '').toLowerCase();
  const uiAuthenticity = (extracted.ui_authenticity     ?? '').toLowerCase();
  const fraudScore     = toNum(extracted.fraud_score, 100);

  console.log(
    `[verifyScreenshot] verified=${verified} confidence=${confidence} channel_match=${channelMatch}` +
    ` sub=${subStatus} ui=${uiAuthenticity} fraud=${fraudScore}` +
    ` detected="${extracted.channel_detected}" reason="${extracted.reason}"`,
  );

  // Gate 1 — model verdict
  if (!verified) {
    if (subStatus === 'not_subscribed')                    return { ok: false, publicReason: 'subscribed_missing' };
    if (!channelMatch || uiAuthenticity === 'manipulated') return { ok: false, publicReason: 'wrong_channel' };
    return { ok: false, publicReason: 'not_youtube' };
  }

  // Gate 2 — independent hard checks (don't trust model's "verified: true" alone)
  if (confidence < 85)               return { ok: false, publicReason: 'wrong_channel' };
  if (!channelMatch)                 return { ok: false, publicReason: 'wrong_channel' };
  if (subStatus !== 'subscribed')    return { ok: false, publicReason: 'subscribed_missing' };
  if (uiAuthenticity !== 'authentic') return { ok: false, publicReason: 'not_youtube' };
  if (fraudScore >= 20)              return { ok: false, publicReason: 'not_youtube' };

  // Gate 3 — name cross-check
  const detected  = (extracted.channel_detected ?? '').toLowerCase().trim();
  const expName   = (refName   ?? '').toLowerCase().trim();
  const expHandle = (refHandle ?? '').toLowerCase().replace(/^@/, '').trim();

  if (expName && detected && !detected.includes(expName) && !expName.includes(detected)) {
    if (!expHandle || !detected.includes(expHandle)) {
      console.log(`[verifyScreenshot] name mismatch: detected="${detected}" expected="${expName}"`);
      return { ok: false, publicReason: 'wrong_channel' };
    }
  }

  console.log('[verifyScreenshot] PASS');
  return { ok: true, publicReason: 'ok' };
}

module.exports = { verifyScreenshotWithGemini, analyzeReferenceImage, toDataUrlFromBuffer };
