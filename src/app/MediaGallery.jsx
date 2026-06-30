import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { MediaUploader } from '@/components/uploads/MediaUploader';
import { Gallery, Item } from 'react-photoswipe-gallery';
import 'photoswipe/dist/photoswipe.css';
import { FileText, Film } from 'lucide-react';

function MetaRow({ m }) {
  return (
    <div className="flex items-center justify-between p-1.5 text-[11px] text-muted-foreground">
      <span className="truncate capitalize">{m.category}</span>
      {m.client_visible && (
        <Badge variant="outline" className="text-[9px]">
          client
        </Badge>
      )}
    </div>
  );
}

/** Lists and uploads media for a job. Images open in a PhotoSwipe lightbox; other
 *  files open in a new tab. Uploading uses the reusable Uppy uploader. */
export function MediaGallery({ jobId, canUpload = false }) {
  const [media, setMedia] = useState(null);
  const [error, setError] = useState(null);
  const [dims, setDims] = useState({});

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

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Site media</h3>

      {canUpload && <MediaUploader jobId={jobId} onUploaded={load} />}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {media === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {media?.length === 0 && <p className="text-sm text-muted-foreground">No media yet.</p>}

      {media && media.length > 0 && (
        <Gallery withCaption>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media.map((m) =>
              m.media_type === 'image' ? (
                <Item
                  key={m.id}
                  original={m.url}
                  thumbnail={m.url}
                  caption={m.caption ?? m.original_filename ?? m.category}
                  width={dims[m.id]?.w ?? 1600}
                  height={dims[m.id]?.h ?? 1200}
                >
                  {({ ref, open }) => (
                    <div className="block overflow-hidden rounded-md border">
                      <button
                        type="button"
                        onClick={open}
                        className="block w-full cursor-zoom-in"
                        aria-label={`Open ${m.caption ?? m.original_filename ?? 'image'}`}
                      >
                        <img
                          ref={ref}
                          src={m.url}
                          alt={m.caption ?? m.original_filename ?? 'media'}
                          className="aspect-square w-full object-cover"
                          onLoad={(e) =>
                            setDims((d) =>
                              d[m.id]
                                ? d
                                : { ...d, [m.id]: { w: e.target.naturalWidth, h: e.target.naturalHeight } },
                            )
                          }
                        />
                      </button>
                      <MetaRow m={m} />
                    </div>
                  )}
                </Item>
              ) : (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-md border"
                >
                  <div className="flex aspect-square w-full items-center justify-center bg-muted">
                    {m.media_type === 'video' ? (
                      <Film className="h-7 w-7 text-muted-foreground" />
                    ) : (
                      <FileText className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <MetaRow m={m} />
                </a>
              ),
            )}
          </div>
        </Gallery>
      )}
    </div>
  );
}
