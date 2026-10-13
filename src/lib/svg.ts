import { brandMarkPath } from '@/components/logo'

export function downloadSvg(svg: string, name: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/\.svg$/i, '').replace(/[\\/:*?"<>|]/g, '-') || 'untitled'}.svg`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function isSvgFile(file: File) {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
}

export const blankSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"></svg>`

export const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <g id="sample-logo">
    <rect id="logo-background" x="140" y="80" width="200" height="200" rx="50" fill="#2b2422" />
    <path id="logo-mark" transform="translate(171.25 111.25) scale(5.729166667)" d="${brandMarkPath}" fill="#f3f1f1" />
  </g>
</svg>`
