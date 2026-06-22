import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { TIMESHEET_STATUSES } from '@/lib/roles';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ContractorTimesheets() {
  const [timesheets, setTimesheets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ job_id: '', week_start: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Timesheet.list('-created_date', 100),
      base44.entities.Job.filter({ archived: false }),
    ]).then(([t, j]) => {
      setTimesheets(t);
      setJobs(j);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    if (!form.job_id || !form.week_start) return;
    setSaving(true);
    const me = await base44.auth.me();
    const created = await base44.entities.Timesheet.create({ ...form, contractor_id: me.id, status: 'draft' });
    setTimesheets(prev => [created, ...prev]);
    setShowCreate(false);
    setForm({ job_id: '', week_start: '' });
    setSaving(false);
  };

  const handleSubmit = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'submitted', submitted_at: new Date().toISOString() });
    setTimesheets(prev => prev.map(t => t.id === id ? { ...t, status: 'submitted' } : t));
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader
        title="Timesheets"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
            <Plus className="w-4 h-4" /> New
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : timesheets.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <p>No timesheets yet</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>Create first timesheet</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {timesheets.map(t => {
            const s = TIMESHEET_STATUSES[t.status];
            const job = jobs.find(j => j.id === t.job_id);
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm font-semibold">Week of {t.week_start}</p>
                    <p className="text-xs text-muted-foreground">{job?.title || 'Unknown job'}</p>
                  </div>
                  {s && <StatusBadge label={s.label} color={s.color} />}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">{t.total_hours ? `${t.total_hours} hours` : 'No hours logged'}</p>
                  {t.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => handleSubmit(t.id)} className="gap-1 h-7 text-xs">
                      <Send className="w-3 h-3" /> Submit
                    </Button>
                  )}
                  {t.rejection_reason && (
                    <p className="text-xs text-red-600">{t.rejection_reason}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Timesheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Job</Label>
              <select className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))}>
                <option value="">Select a job...</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Week Starting</Label>
              <Input type="date" value={form.week_start} onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))} />
            </div>
            <Button onClick={handleCreate} disabled={saving || !form.job_id || !form.week_start} className="w-full">
              {saving ? 'Creating...' : 'Create Timesheet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}