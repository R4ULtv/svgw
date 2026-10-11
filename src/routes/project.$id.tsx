import { createFileRoute } from '@tanstack/react-router'
import { Workspace } from '@/components/workspace'

export const Route = createFileRoute('/project/$id')({ ssr: false, component: ProjectPage })

function ProjectPage() {
  const { id } = Route.useParams()
  return <Workspace projectId={id} />
}
