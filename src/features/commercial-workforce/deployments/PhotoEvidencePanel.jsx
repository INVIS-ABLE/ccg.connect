import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus } from 'lucide-react';

const CATEGORIES = ['before', 'progress', 'safety', 'delivery', 'variation', 'snagging', 'completion', 'materials', 'incident', 'other'];

/**
 * Rapid site photo evidence on a deployment. Take multiple photos quickly (the
 * device camera on mobile), tagged with the chosen category; review them in a
 * categorised gallery. Files stream via the authorised route — no public URLs.
 */
export function PhotoEvidencePanel({ deploymentId }) {
  const [media, setMedia] = useState(null);
  const [category, setCategory] = useState('progress');
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    const r = await api.deploymentMedia.list(deploymentId).catch(() => ({ media: [] }));
    setMedia(r.media ?? []);
  }, [deploymentId]);
  useEffect(() => { void load(); }, [load]);

  async function onFiles(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(files.length);
    try {
      for (const file of files) {
        await api.deploymentMedia.upload(deploymentId, file, { category }).catch(() => null);
        setUploading((n) => n - 1);
      }
      await load();
    } finally {
      setUploading(0);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Camera size={15} /> Site photos</CardTitle>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} />
          <Button size="sm" className="gap-1.5" disabled={uploading > 0} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={14} /> {uploading > 0 ? `Uploading ${uploading}…` : 'Add photos'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {media === null && <p className="text-xs text-muted-foreground">Loading…</p>}
        {media && media.length === 0 && <p className="text-xs text-muted-foreground">No photos yet. Choose a category and tap “Add photos”.</p>}
        {media && media.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {media.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-md border">
                <img src={m.url} alt={m.caption || m.category} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium capitalize text-white">{m.category}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
