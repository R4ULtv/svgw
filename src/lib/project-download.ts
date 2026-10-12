import { serializeProjectFile, type PortableProject } from './project-file'

export function downloadProjectFile(project: PortableProject) {
  const url = URL.createObjectURL(
    new Blob([serializeProjectFile(project)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${project.name.replace(/\.(json|svg)$/i, '').replace(/[\\/:*?"<>|]/g, '-') || 'untitled'}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
