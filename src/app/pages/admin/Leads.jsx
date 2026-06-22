import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const NEXT_STATUS = {
  new: ['contacted', 'rejected'],
  contacted: ['qualified', 'rejected'],
  qualified: ['converted', 'rejected'],
};

export default function Leads() {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    try {
      const r = await api.leads.list();
      setLeads(r.leads);
    } catch {
      setError('Could not load leads.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id, status) {
    setBusy(id);
    try {
      await api.leads.update(id, { status });
      await load();
    } catch {
      setError('Could not update lead.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && leads === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!error && leads?.length === 0 && (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          )}
          {!error && leads && leads.length > 0 && (
            <ul className="divide-y">
              {leads.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{l.name}</span>
                      <Badge variant="secondary">{l.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {l.email}
                      {l.company ? ` · ${l.company}` : ''}
                      {l.work_type ? ` · ${l.work_type}` : ''}
                      {l.site_postcode ? ` · ${l.site_postcode}` : ''}
                    </div>
                    {l.description && (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{l.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {(NEXT_STATUS[l.status] ?? []).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === 'rejected' ? 'outline' : 'default'}
                        disabled={busy === l.id}
                        onClick={() => setStatus(l.id, s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
