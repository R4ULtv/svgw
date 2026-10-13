import { cloudApi } from './cloud-api'
import {
  documentKey,
  projectDocument,
  type CloudLink,
  type RemoteDocument,
  type RemoteMutation,
} from './cloud-types'
import { createProject, newId, type Project } from './projects'
import { sanitizeSvg } from './sanitize-svg'

/** A local project's link after a change to its online project. Content stays as it was saved. */
export function linkAfter(link: CloudLink, result: RemoteMutation): CloudLink {
  return {
    ...link,
    revision: result.revision,
    versionId: result.project.latestVersionId,
    visibility: result.project.visibility,
    publishedVersionId: result.project.publishedVersionId,
  }
}

/**
 * A local copy of an online document, linked to it with nothing left to upload. Pass `existing`
 * to replace that copy in place.
 */
export function copyFromRemote(
  result: RemoteDocument,
  mode: CloudLink['mode'],
  existing?: Project,
): Project {
  const next: Project = {
    ...createProject(result.document.name, sanitizeSvg(result.document.svg)),
    ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
    guides: result.document.guides,
  }
  next.cloud = {
    id: result.project.id,
    mode,
    revision: result.revision,
    versionId: result.versionId,
    savedDocument: documentKey(next),
    visibility: result.project.visibility,
    publishedVersionId: result.project.publishedVersionId,
  }
  return next
}

/** True when the project has edits its online draft does not have yet. */
export function hasUnsavedOnlineChanges(project: Project) {
  return project.cloud?.mode === 'admin' && documentKey(project) !== project.cloud.savedDocument
}

/**
 * Uploads a project as a new version of its online draft, creating the draft when the project has
 * none. `persist` stores each link change on the local project before the next request, so an
 * interrupted upload resumes with the same version id instead of creating a duplicate.
 * Returns the saved link; an up-to-date draft is returned unchanged.
 */
export async function uploadDraft(
  project: Project,
  key: string,
  persist: (link: CloudLink) => Promise<void>,
  onMutation?: (result: RemoteMutation) => void,
): Promise<CloudLink> {
  const document = projectDocument(project)
  const content = documentKey(document)
  let existing = project.cloud
  if (existing?.savedDocument === content && existing.revision) return existing
  // A previous response may have been lost while the user continued editing.
  // Resolve that exact upload first, then create a version for the newer content.
  if (existing?.pendingVersion && existing.pendingVersion.document !== content) {
    const pending = existing.pendingVersion
    const result = await cloudApi.save(
      existing.id,
      key,
      JSON.parse(pending.document),
      pending.id,
      existing.revision,
    )
    onMutation?.(result)
    existing = { ...linkAfter(existing, result), savedDocument: pending.document }
    delete existing.pendingVersion
    await persist(existing)
  }
  const pending =
    existing?.pendingVersion?.document === content
      ? existing.pendingVersion
      : { id: newId(), document: content }
  const link: CloudLink = {
    id: existing?.id ?? project.id,
    mode: 'admin',
    revision: existing?.revision ?? null,
    versionId: existing?.versionId ?? pending.id,
    savedDocument: existing?.savedDocument ?? '',
    visibility: existing?.visibility ?? 'private',
    publishedVersionId: existing?.publishedVersionId ?? null,
    pendingVersion: pending,
  }
  // Persist the upload identity before sending; retries survive a page reload.
  await persist(link)
  const result = await cloudApi.save(link.id, key, document, pending.id, link.revision)
  onMutation?.(result)
  const saved = linkAfter(link, result)
  saved.savedDocument = content
  delete saved.pendingVersion
  await persist(saved)
  return saved
}
