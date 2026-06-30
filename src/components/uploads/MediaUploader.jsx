import { useEffect, useRef, useState } from 'react';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import { Button } from '@/components/ui/button';
import { UploadCloud, X, FileText, Film, Image as ImageIcon, AlertCircle } from 'lucide-react';

// Mirrors the server allow-list (src/domain/media/validation.ts). The server is
// the real gate; this just gives fast client-side feedback.
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
];
const MAX_BYTES = 200 * 1024 * 1024;

const CATEGORIES = [
  'before', 'progress', 'completion', 'materials', 'delivery', 'variation', 'defect', 'snagging', 'incident', 'other',
];

function kindIcon(type) {
  if (type?.startsWith('image/')) return ImageIcon;
  if (type?.startsWith('video/')) return Film;
  return FileText;
}

/**
 * Reusable Uppy-based uploader for job media/evidence (upgrade plan, step 4).
 * Drag-and-drop or pick, multi-file, per-file progress, type/size checks; posts
 * multipart to /api/media (which sets client_visible=false by default and runs
 * server-side validation + authorization). Styled in CCG's Shadcn UI — no Uppy
 * Dashboard CSS.
 */
export function MediaUploader({ jobId, defaultCategory = 'progress', onUploaded }) {
  const uppyRef = useRef(null);
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState(defaultCategory);

  if (!uppyRef.current) {
    uppyRef.current = new Uppy({
      autoProceed: false,
      restrictions: { maxFileSize: MAX_BYTES, allowedFileTypes: ALLOWED_TYPES },
    }).use(XHRUpload, {
      endpoint: '/api/media',
      method: 'POST',
      formData: true,
      fieldName: 'file',
      withCredentials: true,
      limit: 3,
    });
  }
  const uppy = uppyRef.current;

  useEffect(() => {
    uppy.setMeta({ job_id: jobId, category });
  }, [uppy, jobId, category]);

  useEffect(() => {
    function sync() {
      setFiles(
        Object.values(uppy.getState().files).map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          progress: Math.round(f.progress?.percentage ?? 0),
          done: !!f.progress?.uploadComplete,
          error: !!f.error,
        })),
      );
    }
    const onAdded = () => { setError(null); sync(); };
    const onError = (_file, err) => { setError(err?.message || 'Upload failed.'); sync(); };
    const onRestrict = (_file, err) => setError(err?.message || 'That file type or size is not allowed.');
    const onComplete = (result) => {
      setUploading(false);
      sync();
      if (result?.successful?.length) {
        onUploaded?.();
        setTimeout(() => { uppy.clear(); sync(); }, 600);
      }
    };
    uppy.on('upload-progress', sync);
    uppy.on('file-added', onAdded);
    uppy.on('file-removed', sync);
    uppy.on('upload-error', onError);
    uppy.on('restriction-failed', onRestrict);
    uppy.on('complete', onComplete);
    return () => {
      uppy.off('upload-progress', sync);
      uppy.off('file-added', onAdded);
      uppy.off('file-removed', sync);
      uppy.off('upload-error', onError);
      uppy.off('restriction-failed', onRestrict);
      uppy.off('complete', onComplete);
    };
  }, [uppy, onUploaded]);

  useEffect(() => () => uppy.destroy(), [uppy]);

  function addFiles(list) {
    setError(null);
    for (const f of Array.from(list)) {
      try {
        uppy.addFile({ name: f.name, type: f.type, data: f });
      } catch {
        /* restriction-failed event reports the reason */
      }
    }
  }

  function startUpload() {
    setUploading(true);
    uppy.upload().catch(() => setUploading(false));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="mu-category" className="text-xs text-muted-foreground">Category</label>
        <select
          id="mu-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm capitalize"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here or click to choose</p>
        <p className="text-xs text-muted-foreground">Images, video or PDF</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => {
            const Icon = kindIcon(f.type);
            return (
              <div key={f.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                {!uploading && !f.done && (
                  <button onClick={() => uppy.removeFile(f.id)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
                {(uploading || f.done) && (
                  <span className={`text-xs ${f.error ? 'text-destructive' : f.done ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {f.error ? 'Failed' : f.done ? 'Done' : `${f.progress}%`}
                  </span>
                )}
              </div>
            );
          })}
          <Button size="sm" className="w-full" disabled={uploading} onClick={startUpload}>
            {uploading ? 'Uploading…' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
