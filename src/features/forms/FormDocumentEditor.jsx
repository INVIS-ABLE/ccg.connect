import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Download, CheckCircle2, AlertTriangle, Archive } from 'lucide-react';
import { RamsContentEditor } from './RamsContentEditor';
import { FORM_TYPE_LABEL as TYPE_LABEL } from '@/domain/forms/rams';

const STATUS_TONE = { draft: 'secondary', issued: 'default', archived: 'outline' };

/** Edit a filled RAMS / Method Statement document, issue it (only when complete)
 *  and download it as a branded PDF. */
export default function FormDocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [meta, setMeta] = useState({ title: '', reference: '', site_name: '', prepared_by: '' });
  const [content, setContent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [issueError, setIssueError] = useState(null);

  const load = useCallback(async () => {
    const r = await api.forms.documents.get(id).catch(() => null);
    if (r) {
      setDoc(r.document);
      setMeta({
        title: r.document.title,
        reference: r.document.reference ?? '',
        site_name: r.document.site_name ?? '',
        prepared_by: r.document.prepared_by ?? '',
      });
      setContent(r.document.content);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setSaved(false);
    setIssueError(null);
    try {
      await api.forms.documents.update(id, {
        title: meta.title.trim() || doc.title,
        reference: meta.reference.trim() || null,
        site_name: meta.site_name.trim() || null,
        prepared_by: meta.prepared_by.trim() || null,
        content,
      });
      setSaved(true);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function issue() {
    setBusy(true);
    setIssueError(null);
    try {
      // Persist edits first so the server validates the latest content.
      await api.forms.documents.update(id, {
        title: meta.title.trim() || doc.title,
        reference: meta.reference.trim() || null,
        site_name: meta.site_name.trim() || null,
        prepared_by: meta.prepared_by.trim() || null,
        content,
      });
      await api.forms.documents.issue(id);
      await load();
    } catch (err) {
      const missing = err?.body?.missing;
      setIssueError(missing?.length ? `Cannot issue — still missing: ${missing.join(', ')}.` : 'Could not issue this document.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      const { generateRamsBlob } = await import('@/features/documents/RamsDocument');
      const blob = await generateRamsBlob({ ...doc, ...meta, content });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(meta.title || 'document').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    try {
      await api.forms.documents.update(id, { status: 'archived' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!doc || !content) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const completeness = doc.completeness ?? { complete: true, missing: [] };
  const backTo = doc.deployment_id ? `/workforce/deployments/${doc.deployment_id}` : '/forms';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backTo)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{doc.title}</h1>
          <p className="text-xs text-muted-foreground">{TYPE_LABEL[doc.form_type]} · v{doc.version}</p>
        </div>
        <Badge variant={STATUS_TONE[doc.status]} className="capitalize">{doc.status}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Document details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Reference</label>
            <Input value={meta.reference} onChange={(e) => setMeta({ ...meta, reference: e.target.value })} placeholder="e.g. RAMS-2026-014" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Site</label>
            <Input value={meta.site_name} onChange={(e) => setMeta({ ...meta, site_name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Prepared by</label>
            <Input value={meta.prepared_by} onChange={(e) => setMeta({ ...meta, prepared_by: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Content</CardTitle></CardHeader>
        <CardContent>
          <RamsContentEditor formType={doc.form_type} content={content} onChange={setContent} />
        </CardContent>
      </Card>

      {/* Completeness */}
      {!completeness.complete && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Save your edits, then this becomes issuable. Still missing: {completeness.missing.join(', ')}.</span>
        </div>
      )}
      {issueError && <p className="text-xs text-red-600">{issueError}</p>}

      <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button size="sm" disabled={busy} onClick={save} className="gap-1.5"><Save size={14} /> {busy ? 'Saving…' : 'Save'}</Button>
        {saved && <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><CheckCircle2 size={13} /> Saved</span>}
        {doc.status === 'draft' && (
          <Button size="sm" variant="default" disabled={busy} onClick={issue} className="gap-1.5">
            <CheckCircle2 size={14} /> Issue
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={downloadPdf} className="gap-1.5"><Download size={14} /> PDF</Button>
        {doc.status !== 'archived' && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={archive} className="ml-auto gap-1.5 text-muted-foreground"><Archive size={14} /> Archive</Button>
        )}
      </div>
    </div>
  );
}
