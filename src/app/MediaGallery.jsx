import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** Lists and uploads media for a job. Used on job detail screens. */
export function MediaGallery({ jobId, canUpload = false }) {
  const [media, setMedia] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    try {
      const r = await api.media.list(jobId);
      setMedia(r.media);
    } catch {
      setError('Could not load media.');
    }
  }
  useEffect(() => {
    void load();
  }, [jobId]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await api.media.upload(jobId, file, { category: 'progress' });
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `Upload failed (${err.status}).` : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Site media</h3>
        {canUpload && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={onFile}
            />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {media === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {media?.length === 0 && <p className="text-sm text-muted-foreground">No media yet.</p>}

      {media && media.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-md border"
            >
              {m.media_type === 'image' ? (
                <img src={m.url} alt={m.caption ?? m.original_filename ?? 'media'} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted text-2xl">
                  {m.media_type === 'video' ? '🎬' : '📄'}
                </div>
              )}
              <div className="flex items-center justify-between p-1.5 text-[11px] text-muted-foreground">
                <span className="truncate">{m.category}</span>
                {m.client_visible && <Badge variant="outline" className="text-[9px]">client</Badge>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
