import {
  RECENT_VERSION_LIMIT,
  documentKey,
  type ProjectDocument,
  type RemoteProject,
  type VersionInfo,
  type Visibility,
} from '../lib/cloud-types'
import { createAdminSession, verifyAdminSession } from './admin-session'

interface Manifest extends RemoteProject {
  publishedName: string | null
  versions: VersionInfo[]
  deleted?: boolean
}

interface Snapshot {
  id: string
  createdAt: number
  document: ProjectDocument
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const MAX_BODY_BYTES = 8 * 1024 * 1024
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const manifestKey = (id: string) => `projects/${id}.json`
const snapshotKey = (id: string, version: string) => `versions/${id}/${version}.json`

function json(value: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Vary: 'Authorization',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}

async function authorized(request: Request, env: Env, allowSession = true) {
  const header = request.headers.get('Authorization')
  if (!header) return false
  if (!header.startsWith('Bearer ') || header.length > 1024 || !env.ADMIN_KEY)
    throw new HttpError(401, 'Invalid admin key.')
  // Hash to equal-length buffers before the runtime's constant-time comparison.
  const encoder = new TextEncoder()
  const [supplied, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(header.slice(7))),
    crypto.subtle.digest('SHA-256', encoder.encode(env.ADMIN_KEY)),
  ])
  if (crypto.subtle.timingSafeEqual(supplied, expected)) return true
  if (allowSession && (await verifyAdminSession(header.slice(7), env.ADMIN_KEY))) return true
  throw new HttpError(401, 'Invalid or expired remote access. Log in again.')
}

function requireAdmin(admin: boolean, env: Env) {
  if (!env.ADMIN_KEY)
    throw new HttpError(503, 'Remote saving is not configured. Set the ADMIN_KEY Worker secret.')
  if (!admin) throw new HttpError(401, 'An admin key is required.')
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.includes('application/json'))
    throw new HttpError(415, 'Send JSON data.')
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES)
    throw new HttpError(413, 'Projects must be smaller than 8 MiB.')
  if (!request.body) throw new HttpError(400, 'Missing request body.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new HttpError(413, 'Projects must be smaller than 8 MiB.')
    }
    chunks.push(value)
  }
  const buffer = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(buffer))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return parsed as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'Invalid JSON data.')
  }
}

function validId(value: unknown): string {
  if (typeof value !== 'string' || !ID.test(value))
    throw new HttpError(400, 'Invalid project or version ID.')
  return value.toLowerCase()
}

function validDocument(value: unknown): ProjectDocument {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Missing project document.')
  const item = value as Record<string, unknown>
  if (
    typeof item.name !== 'string' ||
    item.name.length > 200 ||
    typeof item.svg !== 'string' ||
    !item.svg.trim() ||
    item.formatVersion !== 1
  ) {
    throw new HttpError(400, 'Invalid project document. Names are limited to 200 characters.')
  }
  let guides: ProjectDocument['guides']
  if (item.guides !== undefined) {
    if (!item.guides || typeof item.guides !== 'object') throw new HttpError(400, 'Invalid guides.')
    const value = item.guides as Record<string, unknown>
    const valid = (axis: unknown): axis is number[] =>
      Array.isArray(axis) &&
      axis.length <= 10_000 &&
      axis.every((n) => typeof n === 'number' && Number.isFinite(n))
    if (!valid(value.x) || !valid(value.y)) throw new HttpError(400, 'Invalid guides.')
    guides = { x: value.x, y: value.y }
  }
  return { name: item.name, svg: item.svg, formatVersion: 1, ...(guides ? { guides } : {}) }
}

async function loadManifest(bucket: R2Bucket, id: string) {
  const object = await bucket.get(manifestKey(id))
  if (!object) throw new HttpError(404, 'Project not found.')
  const manifest = await object.json<Manifest>()
  if (manifest.deleted) throw new HttpError(404, 'Project not found.')
  return { manifest, revision: object.httpEtag }
}

function summary(manifest: Manifest, admin: boolean): RemoteProject {
  return {
    id: manifest.id,
    name: admin ? manifest.name : (manifest.publishedName ?? 'Untitled'),
    createdAt: manifest.createdAt,
    updatedAt: admin ? manifest.updatedAt : manifest.publishedAt!,
    visibility: manifest.visibility,
    latestVersionId: admin ? manifest.latestVersionId : manifest.publishedVersionId!,
    publishedVersionId: manifest.publishedVersionId,
    publishedAt: manifest.publishedAt,
  }
}

/** Store both authorized projections atomically with the manifest, avoiding N+1 reads. */
function listingMetadata(manifest: Manifest): Record<string, string> {
  const listing = JSON.stringify({
    admin: manifest.deleted ? null : summary(manifest, true),
    public:
      !manifest.deleted && manifest.visibility === 'public' && manifest.publishedVersionId
        ? summary(manifest, false)
        : null,
  })
  // Unusual escaped names can exceed R2's metadata limit; those retain the body-read path.
  return new TextEncoder().encode(listing).byteLength <= 1900 ? { listing } : {}
}

function listedProject(object: R2Object, admin: boolean): RemoteProject | null | undefined {
  const listing = object.customMetadata?.listing
  if (!listing) return undefined
  try {
    const projections = JSON.parse(listing) as {
      admin?: RemoteProject | null
      public?: RemoteProject | null
    }
    return admin ? projections.admin : projections.public
  } catch {
    return undefined
  }
}

function checkRevision(request: Request, revision: string) {
  const expected = request.headers.get('If-Match')
  if (!expected) throw new HttpError(428, 'A project revision is required.')
  if (expected !== revision)
    throw new HttpError(
      409,
      'This project changed in another tab or device. Reload the remote draft before saving.',
    )
}

async function commit(bucket: R2Bucket, manifest: Manifest, revision: string) {
  const saved = await bucket.put(manifestKey(manifest.id), JSON.stringify(manifest), {
    onlyIf: new Headers({ 'If-Match': revision }),
    httpMetadata: { contentType: 'application/json' },
    customMetadata: listingMetadata(manifest),
  })
  if (!saved)
    throw new HttpError(
      409,
      'This project changed in another tab or device. Reload the remote draft before saving.',
    )
  return saved.httpEtag
}

async function storeSnapshot(bucket: R2Bucket, projectId: string, snapshot: Snapshot) {
  const stored = await bucket.put(snapshotKey(projectId, snapshot.id), JSON.stringify(snapshot), {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
  })
  if (!stored) {
    const existing = await bucket.get(snapshotKey(projectId, snapshot.id))
    if (
      !existing ||
      documentKey((await existing.json<Snapshot>()).document) !== documentKey(snapshot.document)
    ) {
      throw new HttpError(409, 'This version ID has already been used for different content.')
    }
  }
}

function retainVersions(manifest: Manifest) {
  const recent = new Set(manifest.versions.slice(0, RECENT_VERSION_LIMIT).map((v) => v.id))
  const removed: string[] = []
  manifest.versions = manifest.versions.filter((version) => {
    if (
      recent.has(version.id) ||
      version.pinned ||
      version.id === manifest.publishedVersionId ||
      version.id === manifest.latestVersionId
    )
      return true
    removed.push(snapshotKey(manifest.id, version.id))
    return false
  })
  return removed
}

function cleanup(context: ExecutionContext, bucket: R2Bucket, keys: string[]) {
  if (keys.length)
    context.waitUntil(
      bucket
        .delete(keys)
        .catch(() => console.error(JSON.stringify({ event: 'version_cleanup_failed' }))),
    )
}

async function deleteSnapshots(bucket: R2Bucket, id: string) {
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: `versions/${id}/`, cursor })
    if (page.objects.length) await bucket.delete(page.objects.map((object) => object.key))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}

async function api(request: Request, env: Env, context: ExecutionContext) {
  const url = new URL(request.url)
  if (url.pathname === '/api/admin' && request.method === 'POST') {
    // Only the admin key can start a new week; a session cannot renew itself indefinitely.
    requireAdmin(await authorized(request, env, false), env)
    return json({
      admin: true,
      configured: true,
      session: await createAdminSession(env.ADMIN_KEY),
    })
  }
  const admin = await authorized(request, env)
  if (url.pathname === '/api/admin' && request.method === 'GET')
    return json({ admin, configured: Boolean(env.ADMIN_KEY) })
  if (!env.PROJECTS) throw new HttpError(503, 'Project storage is unavailable.')
  const bucket = env.PROJECTS

  if (url.pathname === '/api/projects') {
    if (request.method === 'GET') {
      const cursor = url.searchParams.get('cursor') ?? undefined
      const page = await bucket.list({
        prefix: 'projects/',
        limit: 100,
        cursor,
        include: ['customMetadata'],
      })
      const projects: RemoteProject[] = []
      // Bound the number of simultaneous R2 operations.
      for (let start = 0; start < page.objects.length; start += 5) {
        const listings = await Promise.all(
          page.objects.slice(start, start + 5).map(async (object) => {
            const cached = listedProject(object, admin)
            if (cached !== undefined) return cached
            const result = await bucket.get(object.key)
            const manifest = result ? await result.json<Manifest>() : null
            return manifest &&
              !manifest.deleted &&
              (admin || (manifest.visibility === 'public' && manifest.publishedVersionId))
              ? summary(manifest, admin)
              : null
          }),
        )
        for (const project of listings) if (project) projects.push(project)
      }
      return json({ projects, cursor: page.truncated ? page.cursor : null })
    }
    if (request.method === 'POST') {
      requireAdmin(admin, env)
      const data = await body(request)
      const id = validId(data.id)
      const versionId = validId(data.versionId)
      const document = validDocument(data.document)
      const existing = await bucket.get(manifestKey(id))
      if (existing) {
        const manifest = await existing.json<Manifest>()
        if (!manifest.deleted && manifest.latestVersionId === versionId) {
          const snapshot = await bucket.get(snapshotKey(id, versionId))
          if (
            snapshot &&
            documentKey((await snapshot.json<Snapshot>()).document) === documentKey(document)
          )
            return json({ project: summary(manifest, true), revision: existing.httpEtag })
        }
        throw new HttpError(409, 'This project ID already exists.')
      }
      const now = Date.now()
      const manifest: Manifest = {
        id,
        name: document.name,
        createdAt: now,
        updatedAt: now,
        visibility: 'private',
        latestVersionId: versionId,
        publishedVersionId: null,
        publishedAt: null,
        publishedName: null,
        versions: [{ id: versionId, createdAt: now, name: document.name, pinned: false }],
      }
      await storeSnapshot(bucket, id, { id: versionId, createdAt: now, document })
      const saved = await bucket.put(manifestKey(id), JSON.stringify(manifest), {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: { contentType: 'application/json' },
        customMetadata: listingMetadata(manifest),
      })
      if (!saved) throw new HttpError(409, 'This project ID already exists.')
      return json({ project: summary(manifest, true), revision: saved.httpEtag }, 201)
    }
    throw new HttpError(405, 'Method not allowed.')
  }

  const match =
    /^\/api\/projects\/([^/]+)(?:\/(versions|publish|visibility|restore)(?:\/([^/]+))?)?$/.exec(
      url.pathname,
    )
  if (!match) throw new HttpError(404, 'Endpoint not found.')
  const id = validId(match[1])
  const action = match[2]
  const versionId = match[3] ? validId(match[3]) : undefined
  // Authorize writes and all version-history access before touching stored project data.
  if (request.method !== 'GET' || action) requireAdmin(admin, env)
  const { manifest, revision } = await loadManifest(bucket, id)

  if (request.method === 'GET') {
    if (action === 'versions') {
      if (!versionId) return json({ versions: manifest.versions, revision })
      if (!manifest.versions.some((v) => v.id === versionId))
        throw new HttpError(404, 'Version not found.')
    } else if (action) throw new HttpError(405, 'Method not allowed.')
    if (!admin && (manifest.visibility !== 'public' || !manifest.publishedVersionId))
      throw new HttpError(404, 'Project not found.')
    const selected = versionId ?? (admin ? manifest.latestVersionId : manifest.publishedVersionId!)
    const object = await bucket.get(snapshotKey(id, selected))
    if (!object) throw new HttpError(404, 'Version not found.')
    const snapshot = await object.json<Snapshot>()
    return json({
      project: summary(manifest, admin),
      document: snapshot.document,
      versionId: selected,
      revision: admin ? revision : null,
    })
  }

  // A successfully committed retry returns its original result even if its If-Match is now stale.
  if (request.method === 'PUT' && !action) {
    const data = await body(request)
    const version = validId(data.versionId)
    const document = validDocument(data.document)
    if (version === manifest.latestVersionId) {
      const snapshot = await bucket.get(snapshotKey(id, version))
      if (
        snapshot &&
        documentKey((await snapshot.json<Snapshot>()).document) === documentKey(document)
      )
        return json({ project: summary(manifest, true), revision })
      throw new HttpError(409, 'This version ID has already been used for different content.')
    }
    checkRevision(request, revision)
    if (manifest.versions.some((v) => v.id === version))
      throw new HttpError(
        409,
        'Versions are immutable. Restore a version to create a new snapshot.',
      )
    const now = Date.now()
    await storeSnapshot(bucket, id, { id: version, createdAt: now, document })
    manifest.latestVersionId = version
    manifest.name = document.name
    manifest.updatedAt = now
    manifest.versions.unshift({ id: version, name: document.name, createdAt: now, pinned: false })
    const removed = retainVersions(manifest)
    const nextRevision = await commit(bucket, manifest, revision)
    cleanup(context, bucket, removed)
    return json({ project: summary(manifest, true), revision: nextRevision })
  }

  checkRevision(request, revision)
  if (request.method === 'DELETE' && !action) {
    // Keep a tombstone: an in-flight save cannot resurrect a deleted project.
    manifest.deleted = true
    await commit(bucket, manifest, revision)
    context.waitUntil(
      deleteSnapshots(bucket, id).catch(() =>
        console.error(JSON.stringify({ event: 'project_cleanup_failed', projectId: id })),
      ),
    )
    return json({ deleted: true })
  }

  if (request.method === 'PATCH' && action === 'versions' && versionId) {
    const data = await body(request)
    if (typeof data.pinned !== 'boolean')
      throw new HttpError(400, 'Specify whether to pin the version.')
    const version = manifest.versions.find((v) => v.id === versionId)
    if (!version) throw new HttpError(404, 'Version not found.')
    version.pinned = data.pinned
  } else if (request.method === 'PATCH' && action === 'visibility' && !versionId) {
    const data = await body(request)
    if (data.visibility !== 'public' && data.visibility !== 'private')
      throw new HttpError(400, 'Invalid visibility.')
    if (data.visibility === 'public' && !manifest.publishedVersionId)
      throw new HttpError(400, 'Publish a version before making the project public.')
    manifest.visibility = data.visibility as Visibility
  } else if (request.method === 'POST' && action === 'publish' && !versionId) {
    const data = await body(request)
    const selected =
      data.versionId === undefined ? manifest.latestVersionId : validId(data.versionId)
    const version = manifest.versions.find((v) => v.id === selected)
    if (!version) throw new HttpError(404, 'Version not found.')
    manifest.publishedVersionId = selected
    manifest.publishedName = version.name
    manifest.publishedAt = Date.now()
    manifest.visibility = 'public'
  } else if (request.method === 'POST' && action === 'restore' && !versionId) {
    const data = await body(request)
    const sourceId = validId(data.versionId)
    if (!manifest.versions.some((v) => v.id === sourceId))
      throw new HttpError(404, 'Version not found.')
    const source = await bucket.get(snapshotKey(id, sourceId))
    if (!source) throw new HttpError(404, 'Version not found.')
    const document = (await source.json<Snapshot>()).document
    const now = Date.now()
    const newVersion = crypto.randomUUID()
    await storeSnapshot(bucket, id, { id: newVersion, createdAt: now, document })
    manifest.latestVersionId = newVersion
    manifest.name = document.name
    manifest.updatedAt = now
    manifest.versions.unshift({
      id: newVersion,
      name: document.name,
      createdAt: now,
      pinned: false,
    })
  } else throw new HttpError(405, 'Method not allowed.')
  const removed = retainVersions(manifest)
  const nextRevision = await commit(bucket, manifest, revision)
  cleanup(context, bucket, removed)
  return json({ project: summary(manifest, true), revision: nextRevision })
}

export default {
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname
    if (path !== '/api' && !path.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      return await api(request, env, context)
    } catch (cause) {
      if (cause instanceof HttpError) return json({ error: cause.message }, cause.status)
      console.error(JSON.stringify({ event: 'project_api_failed', method: request.method, path }))
      return json(
        { error: 'Project storage is temporarily unavailable. Your local draft is safe.' },
        503,
      )
    }
  },
} satisfies ExportedHandler<Env>
