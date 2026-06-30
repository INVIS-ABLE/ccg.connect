import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Archive, CheckCircle2 } from 'lucide-react';
import { RamsContentEditor } from './RamsContentEditor';

const TYPE_LABEL = { rams: 'RAMS', method_statement: 'Method Statement' };

/** Edit a reusable RAMS / Method Statement template (the default content ops
 *  start a site document from). Autosave is manual via Save. */
export default function FormTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const r = await api.forms.templates.get(id).catch(() => null);
    if (r) {
      setTpl(r.template);
      setName(r.template.name);
      setDescription(r.template.description ?? '');
      setContent(r.template.content);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await api.forms.templates.update(id, { name: name.trim() || tpl.name, description: description.trim() || null, content });
      setSaved(true);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    setBusy(true);
    try {
      await api.forms.templates.update(id, { active: !tpl.active });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!tpl || !content) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/forms')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{tpl.name}</h1>
          <p className="text-xs text-muted-foreground">{TYPE_LABEL[tpl.form_type]} template</p>
        </div>
        <Badge variant="secondary">{TYPE_LABEL[tpl.form_type]}</Badge>
        {!tpl.active && <Badge variant="outline">Archived</Badge>}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Template details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use this template…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Content</CardTitle></CardHeader>
        <CardContent>
          <RamsContentEditor formType={tpl.form_type} content={content} onChange={setContent} />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex items-center gap-2 rounded-md border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button size="sm" disabled={busy} onClick={save} className="gap-1.5">
          <Save size={14} /> {busy ? 'Saving…' : 'Save template'}
        </Button>
        {saved && <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><CheckCircle2 size={13} /> Saved</span>}
        <Button size="sm" variant="outline" disabled={busy} onClick={toggleArchive} className="ml-auto gap-1.5">
          <Archive size={14} /> {tpl.active ? 'Archive' : 'Restore'}
        </Button>
      </div>
    </div>
  );
}
