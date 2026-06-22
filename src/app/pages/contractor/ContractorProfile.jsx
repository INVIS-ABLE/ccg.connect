import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FIELDS = [
  ['trading_name', 'Trading name'],
  ['legal_name', 'Legal name'],
  ['primary_trade', 'Primary trade'],
  ['base_postcode', 'Base postcode'],
  ['day_rate', 'Day rate (£)'],
  ['hourly_rate', 'Hourly rate (£)'],
];

export default function ContractorProfile() {
  const [profile, setProfile] = useState(null); // null=loading, false=none, object=loaded
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.contractors.list();
      const mine = r.contractors[0];
      if (mine) {
        setProfile(mine);
        setForm(mine);
      } else {
        setProfile(false);
      }
    } catch {
      setError('Could not load your profile.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function createProfile() {
    setSaving(true);
    try {
      const r = await api.contractors.create({});
      setProfile(r.contractor);
      setForm(r.contractor);
    } catch {
      setError('Could not create your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const patch = {};
      for (const [key] of FIELDS) {
        let v = form[key];
        if (key === 'day_rate' || key === 'hourly_rate') v = v === '' || v == null ? null : Number(v);
        patch[key] = v;
      }
      const r = await api.contractors.update(profile.id, patch);
      setProfile(r.contractor);
      setForm(r.contractor);
      setNotice('Profile saved.');
    } catch {
      setError('Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (profile === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (profile === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Your contractor profile</h1>
        <p className="text-sm text-muted-foreground">You don’t have a profile yet.</p>
        <Button onClick={createProfile} disabled={saving}>
          {saving ? 'Creating…' : 'Create profile'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Your contractor profile</h1>
        <Badge variant="secondary">{profile.approval_status}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={form[key] ?? ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {notice && <span className="text-sm text-green-600">{notice}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
