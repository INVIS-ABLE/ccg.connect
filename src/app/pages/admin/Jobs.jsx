import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Jobs() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', trade_category: '', site_postcode: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.jobs.list();
      setJobs(r.jobs);
    } catch {
      setError('Could not load jobs.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Button onClick={() => setCreating((v) => !v)}>{creating ? 'Cancel' : 'New job'}</Button>
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>New job</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createJob} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade">Trade</Label>
                <Input
                  id="trade"
                  value={form.trade_category}
                  onChange={(e) => setForm({ ...form, trade_category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Site postcode</Label>
                <Input
                  id="postcode"
                  value={form.site_postcode}
                  onChange={(e) => setForm({ ...form, site_postcode: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!error && jobs?.length === 0 && (
            <p className="text-sm text-muted-foreground">No jobs yet — create one above.</p>
          )}
          {!error && jobs && jobs.length > 0 && (
            <ul className="divide-y">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link to={`/jobs/${j.id}`} className="font-medium text-primary hover:underline">
                      {j.title}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      {j.status}
                      {j.trade_category ? ` · ${j.trade_category}` : ''}
                      {j.site_postcode ? ` · ${j.site_postcode}` : ''}
                    </div>
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
