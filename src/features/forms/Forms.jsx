import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, ShieldAlert, ChevronRight } from 'lucide-react';

const TYPE_LABEL = { rams: 'RAMS', method_statement: 'Method Statement' };

/**
 * Forms hub — reusable RAMS & Method Statement templates. Ops author templates
 * here; filled documents are produced from them against a deployment.
 */
export default function Forms() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState(null);
  const [filter, setFilter] = useState('all');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('rams');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.forms.templates.list().catch(() => ({ templates: [] }));
    setTemplates(r.templates ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const r = await api.forms.templates.create({ name: newName.trim(), form_type: newType });
      navigate(`/forms/templates/${r.template.id}`);
    } finally {
      setBusy(false);
    }
  }

  const shown = (templates ?? []).filter((t) => filter === 'all' || t.form_type === filter);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Forms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          RAMS &amp; Method Statement templates. Build a reusable template, then produce a site document from it on a deployment.
        </p>
      </div>

      {/* New template */}
      <Card>
        <CardContent className="py-4">
          <form onSubmit={create} className="flex flex-wrap items-center gap-2">
            <Input
              className="min-w-[12rem] flex-1"
              placeholder="New template name (e.g. Groundworks RAMS)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              <option value="rams">RAMS</option>
              <option value="method_statement">Method Statement</option>
            </select>
            <Button type="submit" size="sm" disabled={busy || !newName.trim()} className="gap-1.5">
              <Plus size={14} /> Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex gap-1 rounded-md border p-0.5 w-fit">
        {['all', 'rams', 'method_statement'].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : TYPE_LABEL[f]}
          </Button>
        ))}
      </div>

      {/* Templates */}
      <div className="space-y-2">
        {templates === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {templates !== null && shown.length === 0 && (
          <p className="text-sm text-muted-foreground">No templates yet. Create one above to get started.</p>
        )}
        {shown.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/forms/templates/${t.id}`)}
            className="flex w-full items-center gap-3 rounded-md border p-3 text-left text-sm hover:bg-muted"
          >
            {t.form_type === 'rams' ? <ShieldAlert size={16} className="text-orange-600" /> : <FileText size={16} className="text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.name}</p>
              {t.description && <p className="truncate text-xs text-muted-foreground">{t.description}</p>}
            </div>
            <Badge variant="secondary">{TYPE_LABEL[t.form_type]}</Badge>
            {!t.active && <Badge variant="outline">Archived</Badge>}
            <ChevronRight size={15} className="text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
