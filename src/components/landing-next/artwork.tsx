import { brandMarkPath } from '@/components/logo'
import { cloudflareMarkPath, githubMarkPath, reactMarkPath } from './brand-icons'

export type Artwork = 'bloom' | 'orbit' | 'logo' | 'brand' | 'github' | 'cloudflare' | 'react'

export const playgroundExamples = [
  { artwork: 'brand', label: 'svgw', color: '#2b2422' },
  { artwork: 'github', label: 'GitHub', color: '#2b2422' },
  { artwork: 'cloudflare', label: 'Cloudflare', color: '#f38020' },
  { artwork: 'react', label: 'React', color: '#4c67b1' },
] as const

export const palettes = [
  { name: 'Forest', color: '#286548' },
  { name: 'Orange', color: '#f38020' },
  { name: 'Ink', color: '#2b2422' },
  { name: 'Blue', color: '#4c67b1' },
] as const

// These are trusted, local illustrations. The same geometry becomes an editable SVG project.
function geometry(artwork: Artwork, color: string) {
  if (artwork === 'brand')
    return `<g transform="translate(48 48) scale(11)" fill="${color}"><path d="${brandMarkPath}"/></g>`
  if (artwork === 'github')
    return `<g transform="translate(48 48) scale(16.5)" fill="${color}"><path d="${githubMarkPath}"/></g>`
  if (artwork === 'cloudflare')
    return `<g transform="translate(48 48) scale(11)" fill="${color}"><path d="${cloudflareMarkPath}"/></g>`
  if (artwork === 'react')
    return `<g transform="translate(48 48) scale(11)" fill="${color}"><path d="${reactMarkPath}"/></g>`
  if (artwork === 'orbit')
    return `<g fill="none" stroke="${color}" stroke-width="15">${[0, 60, 120].map((angle) => `<ellipse cx="180" cy="180" rx="132" ry="51" transform="rotate(${angle} 180 180)"/>`).join('')}</g><circle cx="180" cy="180" r="19" fill="${color}"/>`
  if (artwork === 'logo')
    return `<rect x="60" y="60" width="240" height="240" rx="60" fill="${color}"/><path transform="translate(97.5 97.5) scale(6.875)" d="${brandMarkPath}" fill="#f3f1f1"/>`
  return `<g fill="${color}">${Array.from({ length: 8 }, (_, i) => `<rect x="159" y="46" width="42" height="123" rx="21" transform="rotate(${i * 45} 180 180)"/>`).join('')}<circle cx="180" cy="180" r="34"/></g>`
}

export function artworkSvg(artwork: Artwork, color: string, size = 100) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><g transform="scale(${480 / 360})"><g id="${artwork}-mark" transform="translate(180 180) scale(${size / 100}) translate(-180 -180)">${geometry(artwork, color)}</g></g></svg>`
}

export function ArtworkMark({
  artwork = 'bloom',
  color = '#286548',
  size = 100,
  className,
}: {
  artwork?: Artwork
  color?: string
  size?: number
  className?: string
}) {
  return (
    <svg viewBox="0 0 360 360" fill="none" aria-hidden="true" className={className}>
      <g
        transform={'translate(180 180) scale(' + size / 100 + ') translate(-180 -180)'}
        dangerouslySetInnerHTML={{ __html: geometry(artwork, color) }}
      />
    </svg>
  )
}
