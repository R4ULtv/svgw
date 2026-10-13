import DOMPurify from 'dompurify'

export function sanitizeSvg(source: string) {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('Choose a valid SVG file exported from Illustrator or Affinity.')
  }
  return DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ['xmlns', 'xmlns:xlink'],
  })
}
