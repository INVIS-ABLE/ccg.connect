import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, MapPin, HardHat } from 'lucide-react';

const CHECK_IN_METHODS = ['qr', 'geofence', 'roll_call', 'supervisor', 'manual'];
const EMPTY_SITE = {
  name: '', site_address: '', postcode: '', what3words: '', principal_contractor: '',
  site_manager: '', working_hours: '', ppe_requirements: '', induction_instructions: '',
  site_rules: '', required_cards: '', check_in_method: 'qr', po_number: '', cost_code: '',
};

export default function CommercialProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [sites, setSites] = useState([]);
  const [open, setOpen] = useState(null); // expanded site id
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_SITE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      api.commercial.projects.get(id).catch(() => null),
      api.commercial.sites.list(id).catch(() => ({ sites: [] })),
    ]);
    if (p) setProject(p.project);
    setSites(s.sites ?? []);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function addSite(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await api.commercial.sites.create({ project_id: id, ...payload, name: form.name.trim() });
      setForm(EMPTY_SITE);
      setCreating(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!project) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/commercial/accounts/${project.account_id}`)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-xs text-muted-foreground">
            {project.project_number ? `#${project.project_number}` : 'Project'}
            {project.region_division ? ` · ${project.region_division}` : ''}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">{project.status}</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Sites</CardTitle>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating((v) => !v)}>
            <Plus size={14} /> Add site
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {creating && (
            <form onSubmit={addSite} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-name">Site name</Label>
                <Input id="s-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Address</Label><Input value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>what3words</Label><Input value={form.what3words} onChange={(e) => setForm({ ...form, what3words: e.target.value })} placeholder="///filled.count.soap" /></div>
              <div className="space-y-1.5"><Label>Principal contractor</Label><Input value={form.principal_contractor} onChange={(e) => setForm({ ...form, principal_contractor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Site manager</Label><Input value={form.site_manager} onChange={(e) => setForm({ ...form, site_manager: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Working hours</Label><Input value={form.working_hours} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} placeholder="07:00–17:00" /></div>
              <div className="space-y-1.5"><Label>PO number</Label><Input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Cost code</Label><Input value={form.cost_code} onChange={(e) => setForm({ ...form, cost_code: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="s-checkin">Check-in method</Label>
                <select id="s-checkin" className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.check_in_method} onChange={(e) => setForm({ ...form, check_in_method: e.target.value })}>
                  {CHECK_IN_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Required cards / qualifications</Label><Input value={form.required_cards} onChange={(e) => setForm({ ...form, required_cards: e.target.value })} placeholder="CSCS, CPCS, Thames Water passport…" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>PPE requirements</Label><Input value={form.ppe_requirements} onChange={(e) => setForm({ ...form, ppe_requirements: e.target.value })} placeholder="Orange PPE, safety boots…" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Induction instructions</Label><Textarea rows={2} value={form.induction_instructions} onChange={(e) => setForm({ ...form, induction_instructions: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Site rules</Label><Textarea rows={2} value={form.site_rules} onChange={(e) => setForm({ ...form, site_rules: e.target.value })} /></div>
              <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create site'}</Button></div>
            </form>
          )}

          {sites.length === 0 && !creating && <p className="text-xs text-muted-foreground">No sites yet.</p>}
          {sites.map((s) => (
            <div key={s.id} className="rounded-md border">
              <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-muted">
                <MapPin size={15} className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="truncate text-xs text-muted-foreground">{s.postcode || s.site_address || ''}</span>
                <Badge variant="outline" className="capitalize">{s.status}</Badge>
              </button>
              {open === s.id && (
                <div className="grid gap-x-6 gap-y-1.5 border-t p-3 text-sm sm:grid-cols-2">
                  {[
                    ['Address', [s.site_address, s.postcode].filter(Boolean).join(', ')],
                    ['what3words', s.what3words],
                    ['Principal contractor', s.principal_contractor],
                    ['Site manager', s.site_manager],
                    ['Working hours', s.working_hours],
                    ['Check-in', s.check_in_method],
                    ['PO number', s.po_number],
                    ['Cost code', s.cost_code],
                    ['Required cards', s.required_cards],
                    ['PPE', s.ppe_requirements],
                    ['Induction', s.induction_instructions],
                    ['Site rules', s.site_rules],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className={k === 'Induction' || k === 'Site rules' ? 'sm:col-span-2' : ''}>
                      <span className="text-muted-foreground">{k}: </span><span className="capitalize">{v}</span>
                    </div>
                  ))}
                  <p className="sm:col-span-2 mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HardHat size={12} /> Labour requests &amp; deployments for this site land here next.
                  </p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
