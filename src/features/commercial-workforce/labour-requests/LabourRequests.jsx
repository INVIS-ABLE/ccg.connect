import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Plus, ChevronRight } from 'lucide-react';
import { listEmploymentModels } from '@/domain/commercial/employmentModels';
import { labourRequestStatusLabel } from '@/domain/commercial/labourRequestStatus';

const MODELS = listEmploymentModels();
const EMPTY = {
  account_id: '', project_id: '', site_id: '', title: '', trade: '', number_required: '1',
  employment_model: '', start_date: '', finish_date: '', shift_pattern: '',
  rate_offered: '', charge_rate: '', overtime_rate: '', po_number: '', minimum_qualifications: '',
};

export default function LabourRequests() {
  const [requests, setRequests] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sites, setSites] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [rateCards, setRateCards] = useState([]);

  async function load() {
    try {
      const [r, a] = await Promise.all([api.labourRequests.list(), api.commercial.accounts.list()]);
      setRequests(r.requests);
      setAccounts(a.accounts ?? []);
    } catch {
      setError('Could not load requests.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // Cascade: account → projects, project → sites.
  useEffect(() => {
    if (!form.account_id) { setProjects([]); setRateCards([]); return; }
    api.commercial.projects.list(form.account_id).then((r) => setProjects(r.projects ?? [])).catch(() => setProjects([]));
    api.commercial.rateCards.list(form.account_id)
      .then((r) => setRateCards((r.rate_cards ?? []).filter((rc) => rc.status === 'active')))
      .catch(() => setRateCards([]));
  }, [form.account_id]);
  useEffect(() => {
    if (!form.project_id) { setSites([]); return; }
    api.commercial.sites.list(form.project_id).then((r) => setSites(r.sites ?? [])).catch(() => setSites([]));
  }, [form.project_id]);

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function create(e) {
    e.preventDefault();
    if (!form.account_id || !form.title.trim()) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await api.labourRequests.create({ ...payload, account_id: form.account_id, title: form.title.trim() });
      setForm(EMPTY);
      setCreating(false);
      await load();
    } catch {
      setError('Could not create request.');
    } finally {
      setSaving(false);
    }
  }

  const accountName = (id) => accounts.find((a) => a.id === id)?.legal_name ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ClipboardList className="text-primary" size={22} /> Labour requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Structured worker orders against a client account, project and site.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating((v) => !v)} disabled={accounts.length === 0}>
          <Plus size={16} /> New request
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {accounts.length === 0 && <p className="text-sm text-muted-foreground">Create a corporate account first.</p>}

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New labour request</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Account</Label>
                <select required className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.account_id} onChange={(e) => set({ account_id: e.target.value, project_id: '', site_id: '' })}>
                  <option value="">Select…</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.legal_name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.project_id} onChange={(e) => set({ project_id: e.target.value, site_id: '' })} disabled={!form.account_id}>
                  <option value="">—</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.site_id} onChange={(e) => set({ site_id: e.target.value })} disabled={!form.project_id}>
                  <option value="">—</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Title</Label><Input required value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Aylesford groundworks gang" /></div>
              <div className="space-y-2"><Label>Trade</Label><Input value={form.trade} onChange={(e) => set({ trade: e.target.value })} /></div>
              <div className="space-y-2"><Label>Number required</Label><Input type="number" min="1" value={form.number_required} onChange={(e) => set({ number_required: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Employment model</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.employment_model} onChange={(e) => set({ employment_model: e.target.value })}>
                  <option value="">—</option>
                  {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>PO number</Label><Input value={form.po_number} onChange={(e) => set({ po_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Finish date</Label><Input type="date" value={form.finish_date} onChange={(e) => set({ finish_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Shift pattern</Label><Input value={form.shift_pattern} onChange={(e) => set({ shift_pattern: e.target.value })} placeholder="07:00–17:00" /></div>

              {/* Prefill rates from the account's agreed rate card. */}
              {rateCards.length > 0 && (
                <div className="space-y-2 sm:col-span-3">
                  <Label>Apply rate card</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value=""
                    onChange={(e) => {
                      const rc = rateCards.find((x) => x.id === e.target.value);
                      if (!rc) return;
                      set({
                        trade: rc.trade ?? form.trade,
                        rate_offered: rc.pay_rate != null ? String(rc.pay_rate) : form.rate_offered,
                        charge_rate: rc.charge_rate != null ? String(rc.charge_rate) : form.charge_rate,
                        overtime_rate: rc.overtime_rate != null ? String(rc.overtime_rate) : form.overtime_rate,
                      });
                    }}
                  >
                    <option value="">Choose a rate card to fill rates…</option>
                    {rateCards.map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.trade}{rc.role ? ` · ${rc.role}` : ''} — £{rc.pay_rate ?? '?'} pay / £{rc.charge_rate ?? '?'} charge /{rc.unit}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2"><Label>Pay rate £/hr</Label><Input type="number" min="0" step="0.01" value={form.rate_offered} onChange={(e) => set({ rate_offered: e.target.value })} /></div>
              <div className="space-y-2"><Label>Charge rate £/hr</Label><Input type="number" min="0" step="0.01" value={form.charge_rate} onChange={(e) => set({ charge_rate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Overtime £/hr</Label><Input type="number" min="0" step="0.01" value={form.overtime_rate} onChange={(e) => set({ overtime_rate: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-3"><Label>Minimum qualifications</Label><Input value={form.minimum_qualifications} onChange={(e) => set({ minimum_qualifications: e.target.value })} placeholder="CSCS, CPCS, Thames Water passport…" /></div>
              <div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create request'}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {requests === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {requests?.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}

      <div className="grid gap-3">
        {requests?.map((r) => (
          <Link key={r.id} to={`/workforce/requests/${r.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-4">
                <ClipboardList size={18} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {accountName(r.account_id)} · {r.number_required}× {r.trade || 'workers'}
                    {r.start_date ? ` · from ${r.start_date}` : ''}
                  </p>
                </div>
                <Badge variant="secondary">{labourRequestStatusLabel(r.status)}</Badge>
                <ChevronRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
