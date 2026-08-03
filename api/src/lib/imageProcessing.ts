import sharp from 'sharp'

// Capped longest-edge dimension for uploaded media — originals up to the 5MB
// upload cap were previously served unresized and unconverted; this is the
// actual cost/perf win the media CDN sits on top of (see issue #87 Part B).
const MAX_DIMENSION = 2000

/**
 * Resizes (capped at MAX_DIMENSION on the longest edge, never upscaled) and
 * converts an uploaded image to WebP. `animated: true` preserves GIF frames
 * as an animated WebP instead of collapsing them to a single still frame —
 * harmless to pass for already-static formats.
 */
export async function convertToWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { animated: true })
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp()
    .toBuffer()
}
