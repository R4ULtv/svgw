import { createFileRoute } from '@tanstack/react-router'
import { ProjectsPage } from '@/components/projects-page'

export const Route = createFileRoute('/projects')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Projects — svgw' }] }),
  component: ProjectsPage,
})
