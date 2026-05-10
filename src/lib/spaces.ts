// DigitalOcean Spaces client. Spaces is S3-compatible, so we use the AWS SDK
// pointed at DO's regional endpoint. Credentials are S3-style access keys
// (separate from the DO Personal Access Token) — get them from
// https://cloud.digitalocean.com/account/api/spaces and put them in
// .env.local. Never committed.
//
// Folder layout (mirrored by the migration script):
//   <bucket>/brand/{logo,hero,social}/...     — committed brand assets
//   <bucket>/products/<sku>.webp              — canonical product photos
//   <bucket>/team/<name>.jpg                  — owner + family
//   <bucket>/uploads/threads/<thread>/...     — chat attachments
//   <bucket>/uploads/orders/<order>/...       — custom-cake / B2B order refs
//   <bucket>/uploads/admin/...                — owner-uploaded marketing
//
// Public reads: bucket ACL is set to public-read in the migration script,
// so all <CDN>/<key> URLs work without signed access.

import { S3Client, PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3'
import { randomBytes } from 'node:crypto'

export interface SpacesConfig {
  endpoint: string // e.g. https://nyc3.digitaloceanspaces.com
  region: string // e.g. nyc3
  bucket: string // e.g. happycake-assets
  accessKey: string
  secret: string
  /** Public CDN host. Defaults to <bucket>.<region>.cdn.digitaloceanspaces.com */
  cdnBase?: string
}

export function loadSpacesConfig(): SpacesConfig | null {
  const region = process.env.SPACES_REGION
  const bucket = process.env.SPACES_BUCKET
  const accessKey = process.env.SPACES_KEY
  const secret = process.env.SPACES_SECRET
  if (!region || !bucket || !accessKey || !secret) return null
  const endpoint = process.env.SPACES_ENDPOINT ?? `https://${region}.digitaloceanspaces.com`
  const cdnBase = process.env.SPACES_CDN_BASE ?? `https://${bucket}.${region}.cdn.digitaloceanspaces.com`
  return { endpoint, region, bucket, accessKey, secret, cdnBase }
}

let _client: S3Client | null = null
function client(cfg: SpacesConfig): S3Client {
  if (_client) return _client
  _client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: false, // Spaces uses virtual-hosted-style URLs
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secret,
    },
  })
  return _client
}

// Generate a content-addressable key for an upload. Keeps related items
// together (same thread / order id), names the file with a date prefix +
// short random id so listings sort chronologically + filenames don't
// collide. Extension comes from the upload's MIME type.
export interface UploadKeyArgs {
  scope: 'thread' | 'order' | 'admin'
  scopeId?: string
  mimeType: string
}
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export function buildUploadKey({ scope, scopeId, mimeType }: UploadKeyArgs): string {
  const ext = MIME_EXT[mimeType.toLowerCase()] ?? 'bin'
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const rand = randomBytes(6).toString('hex')
  if (scope === 'admin') return `uploads/admin/${date}_${rand}.${ext}`
  const id = (scopeId ?? 'unscoped').replace(/[^a-z0-9_-]/gi, '_').slice(0, 64)
  return `uploads/${scope}s/${id}/${date}_${rand}.${ext}`
}

export interface UploadInput {
  key: string
  body: Uint8Array | Buffer
  mimeType: string
  /** Spaces ACL. We use 'public-read' for chat attachments so the URL works
   * without signing. If you need private uploads, set 'private' and serve
   * via presigned URLs. */
  acl?: 'public-read' | 'private'
}

export interface UploadResult {
  key: string
  url: string
  bytes: number
}

export async function uploadToSpaces(cfg: SpacesConfig, input: UploadInput): Promise<UploadResult> {
  const params: PutObjectCommandInput = {
    Bucket: cfg.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.mimeType,
    ACL: input.acl ?? 'public-read',
    CacheControl: 'public, max-age=31536000, immutable',
  }
  await client(cfg).send(new PutObjectCommand(params))
  return {
    key: input.key,
    url: `${cfg.cdnBase}/${input.key}`,
    bytes: input.body.byteLength,
  }
}

// Allowed file types + size cap. Configured here so the upload endpoint and
// the migration script use the same gate.
export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024, // 10 MB
  allowedMime: new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ]),
}
