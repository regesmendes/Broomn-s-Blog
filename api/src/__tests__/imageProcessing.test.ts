import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'

// setup.ts mocks lib/imageProcessing globally (route-level tests upload fake,
// non-image buffers) — undo that here to test the real sharp conversion.
vi.unmock('../lib/imageProcessing')

describe('convertToWebp', () => {
  it('converts a PNG to WebP, preserving dimensions under the cap', async () => {
    const { convertToWebp } = await import('../lib/imageProcessing')
    const input = await sharp({
      create: { width: 100, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()

    const output = await convertToWebp(input)
    const meta = await sharp(output).metadata()

    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(100)
    expect(meta.height).toBe(50)
  })

  it('caps the longest edge at 2000px without upscaling smaller images', async () => {
    const { convertToWebp } = await import('../lib/imageProcessing')
    const input = await sharp({
      create: { width: 4000, height: 1000, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .png()
      .toBuffer()

    const output = await convertToWebp(input)
    const meta = await sharp(output).metadata()

    expect(meta.width).toBe(2000)
    expect(meta.height).toBe(500)
  })

  it('leaves an image already smaller than the cap at its original size', async () => {
    const { convertToWebp } = await import('../lib/imageProcessing')
    const input = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer()

    const output = await convertToWebp(input)
    const meta = await sharp(output).metadata()

    expect(meta.width).toBe(300)
    expect(meta.height).toBe(200)
  })

  it('preserves animation frames when converting an animated GIF', async () => {
    const { convertToWebp } = await import('../lib/imageProcessing')
    const frame = (r: number) =>
      sharp({ create: { width: 10, height: 10, channels: 3, background: { r, g: 0, b: 0 } } })
        .png()
        .toBuffer()
    const frames = await Promise.all([frame(255), frame(0), frame(128)])
    const animatedGif = await sharp(frames, { join: { animated: true, pageHeight: 10 } })
      .gif()
      .toBuffer()

    const output = await convertToWebp(animatedGif)
    const meta = await sharp(output, { animated: true }).metadata()

    expect(meta.format).toBe('webp')
    expect(meta.pages).toBe(3)
  })
})
