import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, ChevronRight } from 'lucide-react';

export default function Gangs() {
  const [gangs, setGangs] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', base_postcode: '', usual_day_rate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const r = await api.gangs.list();
      setGangs(r.gangs);
    } catch {
      setError('Could not load gangs.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.gangs.create({
        name: form.name.trim(),
        base_postcode: form.base_postcode.trim() || undefined,
        usual_day_rate: form.usual_day_rate ? Number(form.usual_day_rate) : undefined,
      });
      setForm({ name: '', base_postcode: '', usual_day_rate: '' });
      setCreating(false);
      await load();
    } catch {
      setError('Could not create gang.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="text-primary" size={22} /> Gangs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Reusable teams under a gang leader. Every member is still checked individually.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating((v) => !v)}>
          <Plus size={16} /> New gang
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {creating && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New gang</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="gn">Gang name</Label><Input id="gn" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kent Groundworks Team A" /></div>
              <div className="space-y-2"><Label htmlFor="gp">Base postcode</Label><Input id="gp" value={form.base_postcode} onChange={(e) => setForm({ ...form, base_postcode: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="gr">Usual day rate £</Label><Input id="gr" type="number" min="0" value={form.usual_day_rate} onChange={(e) => setForm({ ...form, usual_day_rate: e.target.value })} /></div>
              <div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {gangs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {gangs?.length === 0 && <p className="text-sm text-muted-foreground">No gangs yet.</p>}

      <div className="grid gap-3">
        {gangs?.map((g) => (
          <Link key={g.id} to={`/workforce/gangs/${g.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-4">
                <Users size={18} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{g.base_postcode || 'No base postcode'}{g.usual_day_rate ? ` · £${g.usual_day_rate}/day` : ''}</p>
                </div>
                <Badge variant="secondary" className="capitalize">{g.status}</Badge>
                <ChevronRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
