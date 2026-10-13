import { createFileRoute } from '@tanstack/react-router'
import { Workspace } from '@/components/workspace'
import { loadCanvas } from '@/lib/load-canvas'

export const Route = createFileRoute('/project/$id')({
  ssr: false,
  loader: () => {
    // Fetch in parallel with the code-split component without delaying its loading UI.
    void loadCanvas().catch(() => {})
  },
  component: ProjectPage,
})

function ProjectPage() {
  const { id } = Route.useParams()
  return <Workspace projectId={id} />
}
