import {
  formatCss,
  formatHex,
  formatHex8,
  formatHsl,
  formatRgb,
  modeHsl,
  modeOklch,
  modeRgb,
  parse,
  useMode as registerColorMode,
} from 'culori/fn'
import type { Color } from 'culori/fn'

// Register only the spaces the editor uses; importing all of Culori prevents tree-shaking.
const rgb = registerColorMode(modeRgb)
const hsl = registerColorMode(modeHsl)
const oklch = registerColorMode(modeOklch)

export const COLOR_FORMATS = ['hex', 'rgb', 'hsl', 'oklch'] as const
export type ColorFormat = (typeof COLOR_FORMATS)[number]
export type ChannelFormat = Exclude<ColorFormat, 'hex'>

const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, value))
const hue = (value = 0) => (value % 360 < 0 ? (value % 360) + 360 : value % 360)
const rounded = (value: number, digits = 2) => String(Number(value.toFixed(digits)))

function parseColor(value: string): Color | undefined {
  const text = value.trim().toLowerCase()
  const color = parse(/^[\da-f]{3,8}$/.test(text) ? `#${text}` : text)
  if (
    !color ||
    Object.values(color).some((part) => typeof part === 'number' && !Number.isFinite(part))
  )
    return
  return color
}

function hex(color: Color) {
  return (color.alpha ?? 1) < 1 ? formatHex8(color) : formatHex(color)
}

/** Normalizes CSS input, retaining OKLCH and its gamut instead of clipping it to sRGB. */
export function normalizeColor(value: string): string | null {
  const color = parseColor(value)
  if (!color) return null
  if (color.mode === 'oklch')
    return formatCss({ ...color, l: color.l ?? 0, c: color.c ?? 0, h: hue(color.h) })
  return hex(color)
}

/** The sRGB representation used by react-colorful. Never use this to store OKLCH input. */
export function colorToHex(value: string): string | null {
  const color = parseColor(value)
  return color ? hex(color) : null
}

export function isOutsideSrgb(value: string) {
  const color = rgb(parseColor(value))
  // Allow floating point noise at the boundaries (e.g. OKLCH white).
  return color
    ? [color.r, color.g, color.b].some((channel) => channel < -0.00001 || channel > 1.00001)
    : false
}

export function formatColor(value: string, format: ColorFormat): string {
  const color = parseColor(value)
  if (!color) return ''
  if (format === 'hex') return hex(color)
  if (format === 'rgb') return formatRgb(color)
  if (format === 'hsl') return formatHsl(color)
  const converted = oklch(color)
  return `oklch(${rounded(converted.l * 100, 4)}% ${rounded(converted.c, 6)} ${rounded(hue(converted.h), 4)}${(converted.alpha ?? 1) < 1 ? ` / ${rounded(converted.alpha!, 6)}` : ''})`
}

/** Channel inputs are R/G/B (0–255), H/S/L (degrees/%/%), or L/C/H (%/number/degrees), then alpha %. */
export function colorChannels(value: string, format: ChannelFormat): string[] {
  const color = parseColor(value) ?? { mode: 'rgb', r: 0, g: 0, b: 0 }
  const alpha = rounded(clamp(color.alpha ?? 1) * 100)
  if (format === 'rgb') {
    const converted = rgb(color)
    return [converted.r, converted.g, converted.b]
      .map((part) => rounded(clamp(part) * 255, 0))
      .concat(alpha)
  }
  if (format === 'hsl') {
    const converted = hsl(color)
    return [
      rounded(hue(converted.h)),
      rounded(clamp(converted.s) * 100),
      rounded(clamp(converted.l) * 100),
      alpha,
    ]
  }
  const converted = oklch(color)
  return [
    rounded(clamp(converted.l) * 100, 4),
    rounded(converted.c, 6),
    rounded(hue(converted.h), 4),
    alpha,
  ]
}

/** Reject incomplete or out-of-range channels without changing the document. */
export function colorFromChannels(format: ChannelFormat, values: string[]): string | null {
  if (values.length !== 4 || values.some((value) => !value.trim())) return null
  const [a, b, c, alpha] = values.map(Number)
  if (![a, b, c, alpha].every(Number.isFinite) || alpha < 0 || alpha > 100) return null
  if (format === 'rgb') {
    if ([a, b, c].some((value) => value < 0 || value > 255)) return null
    return hex({ mode: 'rgb', r: a / 255, g: b / 255, b: c / 255, alpha: alpha / 100 })
  }
  if (format === 'hsl') {
    if (a < 0 || a > 360 || b < 0 || b > 100 || c < 0 || c > 100) return null
    return hex({ mode: 'hsl', h: hue(a), s: b / 100, l: c / 100, alpha: alpha / 100 })
  }
  if (a < 0 || a > 100 || b < 0 || c < 0 || c > 360) return null
  return formatCss({ mode: 'oklch', l: a / 100, c: b, h: hue(c), alpha: alpha / 100 })
}
