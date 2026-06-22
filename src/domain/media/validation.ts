/**
 * Upload validation for job media / documents. Pure and unit-tested. Enforces an
 * allow-list of content types and per-type size caps (CLAUDE.md: validate file
 * type and size before upload).
 */
export type MediaType = 'image' | 'video' | 'document';

const RULES: Record<MediaType, { types: readonly string[]; maxBytes: number }> = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
    maxBytes: 15 * 1024 * 1024,
  },
  video: {
    types: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxBytes: 200 * 1024 * 1024,
  },
  document: {
    types: ['application/pdf'],
    maxBytes: 25 * 1024 * 1024,
  },
};

/** The media bucket a content type belongs to, or null if not allowed. */
export function classifyMedia(contentType: string): MediaType | null {
  const ct = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  for (const key of Object.keys(RULES) as MediaType[]) {
    if (RULES[key].types.includes(ct)) return key;
  }
  return null;
}

export interface UploadValidation {
  ok: boolean;
  mediaType?: MediaType;
  reason?: 'unsupported_type' | 'empty_file' | 'too_large';
}

export function validateUpload(contentType: string, size: number): UploadValidation {
  const mediaType = classifyMedia(contentType);
  if (!mediaType) return { ok: false, reason: 'unsupported_type' };
  if (size <= 0) return { ok: false, reason: 'empty_file' };
  if (size > RULES[mediaType].maxBytes) return { ok: false, reason: 'too_large' };
  return { ok: true, mediaType };
}
