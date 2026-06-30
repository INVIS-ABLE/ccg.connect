import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ShieldAlert, Plus, ChevronRight } from 'lucide-react';

const TYPE_LABEL = { rams: 'RAMS', method_statement: 'Method Statement' };
const STATUS_TONE = { draft: 'secondary', issued: 'default', archived: 'outline' };
const BAND_TONE = {
  low: 'text-green-700 dark:text-green-400',
  medium: 'text-amber-700 dark:text-amber-400',
  high: 'text-red-700 dark:text-red-400',
};

/**
 * RAMS / Method Statement documents for a deployment. Lists the deployment's
 * documents and starts a new one from a template (seeded with that template's
 * content), pre-filling the site name.
 */
export function DeploymentDocuments({ deploymentId, siteName }) {
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, t] = await Promise.all([
      api.forms.documents.list(deploymentId).catch(() => ({ documents: [] })),
      api.forms.templates.list().catch(() => ({ templates: [] })),
    ]);
    setDocs(d.documents ?? []);
    setTemplates((t.templates ?? []).filter((tpl) => tpl.active));
  }, [deploymentId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function createFromTemplate() {
    if (!pick) return;
    setBusy(true);
    try {
      const tpl = templates.find((t) => t.id === pick);
      const r = await api.forms.documents.create({
        deployment_id: deploymentId,
        template_id: pick,
        form_type: tpl?.form_type,
        title: tpl ? `${tpl.name}` : 'RAMS',
        site_name: siteName || undefined,
      });
      navigate(`/forms/documents/${r.document.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {docs === null && <p className="text-xs text-muted-foreground">Loading…</p>}
      {docs !== null && docs.length === 0 && <p className="text-xs text-muted-foreground">No RAMS or method statements yet.</p>}
      {(docs ?? []).map((d) => (
        <button
          key={d.id}
          onClick={() => navigate(`/forms/documents/${d.id}`)}
          className="flex w-full items-center gap-3 rounded-md border p-2.5 text-left text-sm hover:bg-muted"
        >
          {d.form_type === 'rams' ? <ShieldAlert size={15} className="text-orange-600" /> : <FileText size={15} className="text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{d.title}</p>
            <p className="text-xs text-muted-foreground">
              {TYPE_LABEL[d.form_type]} · v{d.version}
              {d.highest_residual ? <span className={`ml-1 font-medium ${BAND_TONE[d.highest_residual]}`}>· {d.highest_residual} residual risk</span> : ''}
              {!d.completeness?.complete ? ' · incomplete' : ''}
            </p>
          </div>
          <Badge variant={STATUS_TONE[d.status]} className="capitalize">{d.status}</Badge>
          <ChevronRight size={15} className="text-muted-foreground" />
        </button>
      ))}

      <div className="flex gap-2 pt-1">
        <select
          className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">{templates.length ? 'New from template…' : 'No active templates — create one in Forms'}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({TYPE_LABEL[t.form_type]})</option>
          ))}
        </select>
        <Button size="sm" disabled={busy || !pick} onClick={createFromTemplate} className="shrink-0 gap-1.5">
          <Plus size={14} /> Create
        </Button>
      </div>
    </div>
  );
}
