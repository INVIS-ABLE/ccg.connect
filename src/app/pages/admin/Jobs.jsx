import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText } from 'lucide-react';

const STATUS_OPTIONS = ['all', 'enquiry', 'quoted', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const STATUS_COLOR = {
  draft: 'bg-gray-100 text-gray-600',
  enquiry: 'bg-blue-100 text-blue-700',
  quoted: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', trade_category: '', site_postcode: '' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());

  async function load() {
    try {
      const r = await api.jobs.list();
      setJobs(r.jobs);
    } catch {
      setError('Could not load jobs.');
    }
  }
  useEffect(() => { void load(); }, []);

  async function createJob(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.jobs.create(form);
      setForm({ title: '', trade_category: '', site_postcode: '' });
      setCreating(false);
      await load();
    } catch {
      setError('Could not create job.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = (jobs ?? []).filter(
    (j) => statusFilter === 'all' || j.status === statusFilter,
  );

  const completedFiltered = filtered.filter((j) => j.status === 'completed');

  function toggleJob(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllCompleted() {
    const allIds = new Set(completedFiltered.map((j) => j.id));
    const allSelected = completedFiltered.every((j) => selected.has(j.id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...allIds]));
    }
  }

  function goToInvoices() {
    // Pass selected IDs via URL state to the bulk invoice page
    navigate('/invoices', { state: { preselected: [...selected] } });
  }

  const selectedCount = [...selected].filter((id) =>
    (jobs ?? []).find((j) => j.id === id)?.status === 'completed',
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button onClick={goToInvoices} className="flex items-center gap-2" size="sm">
              <FileText size={15} />
              Invoice {selectedCount} job{selectedCount !== 1 ? 's' : ''}
            </Button>
          )}
          <Button onClick={() => setCreating((v) => !v)} variant={creating ? 'outline' : 'default'}>
            {creating ? 'Cancel' : 'New job'}
          </Button>
        </div>
      </div>

      {creating && (
        <Card>
          <CardHeader><CardTitle>New job</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createJob} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="title">Title</Label>
                <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade">Trade</Label>
                <Input id="trade" value={form.trade_category} onChange={(e) => setForm({ ...form, trade_category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Site postcode</Label>
                <Input id="postcode" value={form.site_postcode} onChange={(e) => setForm({ ...form, site_postcode: e.target.value })} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelected(new Set()); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {completedFiltered.length > 0 && (
          <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
            <Checkbox
              id="select-all-completed"
              checked={completedFiltered.length > 0 && completedFiltered.every((j) => selected.has(j.id))}
              onCheckedChange={toggleAllCompleted}
            />
            <Label htmlFor="select-all-completed" className="cursor-pointer text-xs">
              Select all completed
            </Label>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!error && filtered.length === 0 && jobs !== null && (
            <p className="text-sm text-muted-foreground">No jobs found.</p>
          )}
          {!error && filtered.length > 0 && (
            <ul className="divide-y">
              {filtered.map((j) => {
                const isCompleted = j.status === 'completed';
                const isChecked = selected.has(j.id);
                return (
                  <li key={j.id} className={`flex items-center gap-3 py-3 ${isChecked ? 'bg-primary/5 -mx-4 px-4 rounded' : ''}`}>
                    {isCompleted && (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleJob(j.id)}
                        aria-label={`Select ${j.title}`}
                      />
                    )}
                    {!isCompleted && <div className="w-4" />}
                    <div className="flex-1 min-w-0">
                      <Link to={`/jobs/${j.id}`} className="font-medium text-primary hover:underline">
                        {j.title}
                      </Link>
                      <div className="text-sm text-muted-foreground">
                        {j.trade_category ? `${j.trade_category} · ` : ''}{j.site_postcode ?? ''}
                        {j.start_date ? ` · ${new Date(j.start_date).toLocaleDateString('en-GB')}` : ''}
                      </div>
                    </div>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium flex-shrink-0 ${STATUS_COLOR[j.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {j.status?.replace('_', ' ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-card border shadow-lg rounded-full px-5 py-3">
          <span className="text-sm font-medium">{selectedCount} completed job{selectedCount !== 1 ? 's' : ''} selected</span>
          <Button size="sm" onClick={goToInvoices} className="flex items-center gap-2">
            <FileText size={14} /> Generate invoice
          </Button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}
    </div>
  );
}