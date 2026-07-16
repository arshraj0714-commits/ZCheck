/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const { verifyScreenshotWithGemini, analyzeReferenceImage, toDataUrlFromBuffer } = require('./geminiVision');

async function verifyScreenshotAttachment(attachment, config) {
  const { imageSize } = require('image-size');
  const { MAX_SCREENSHOT_BYTES } = require('../constants');

  if (!isSupportedImageAttachment(attachment)) {
    return fail('not_youtube');
  }

  if (attachment.size && attachment.size > MAX_SCREENSHOT_BYTES) {
    return fail('not_youtube');
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    return fail('vision_service_error');
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (!safeImageSize(buffer, imageSize)) {
    return fail('not_youtube');
  }

  const userImageDataUrl = toDataUrlFromBuffer(buffer, attachment.contentType ?? 'image/png');

  // ── Ensure reference channel data is available ────────────────────────────
  // Fast path: cached analysis from DB — no extra API call.
  // Fallback: re-analyze stored reference image if cache is empty.
  let referenceChannelData = config.referenceChannelData ?? null;

  if (!referenceChannelData && config.referenceImageData) {
    try {
      referenceChannelData = await analyzeReferenceImage({ imageDataUrl: config.referenceImageData });
      console.log('[verify] Re-analyzed reference image:', JSON.stringify(referenceChannelData));
    } catch (e) {
      console.warn('[verify] Reference re-analysis failed:', e?.message ?? e);
    }
  }

  // ── Run verification ──────────────────────────────────────────────────────
  // Passes BOTH the reference image AND the user image to Gemini for direct
  // side-by-side visual comparison — most accurate approach.
  let result;
  try {
    result = await verifyScreenshotWithGemini({
      referenceImageData:   config.referenceImageData   ?? null,
      userImageDataUrl,
      referenceChannelData,
      youtubeHandle:        config.youtubeHandle        ?? null,
      youtubeTitle:         config.youtubeTitle         ?? null,
    });
  } catch (e) {
    console.warn('[verifyScreenshotAttachment] Vision threw:', e?.message ?? e);
    return fail('vision_service_error');
  }

  if (result?.ok) {
    return { ok: true, publicReason: 'ok' };
  }

  const reason = result?.publicReason ?? 'not_specified_channel';

  if (reason === 'subscribed_missing') return fail('not_subscribed');
  if (reason === 'wrong_channel')      return fail('not_specified_channel');
  if (reason === 'not_youtube')        return fail('not_youtube');

  return fail(reason);
}

function isSupportedImageAttachment(attachment) {
  const name        = attachment.name        ?? '';
  const contentType = attachment.contentType ?? '';
  return contentType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(name);
}

function safeImageSize(buffer, imageSizeFn) {
  try { return imageSizeFn(buffer); } catch { return null; }
}

function fail(publicReason) {
  return { ok: false, publicReason };
}

module.exports = { verifyScreenshotAttachment };
