import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, ArrowLeft } from 'lucide-react';

const TRADE_TYPES = [
  'General building', 'Carpentry & joinery', 'Electrical', 'Plumbing & heating',
  'Plastering', 'Painting & decorating', 'Roofing', 'Groundworks', 'Landscaping',
  'Tiling', 'Flooring', 'Brickwork & masonry', 'Steel fabrication', 'Other',
];

export default function ClientJobSubmit() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    trade_category: '',
    site_postcode: '',
    site_address: '',
    start_date: '',
    end_date: '',
    urgency: 'medium',
    short_description: '',
    client_visible_notes: '',
  });

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.jobs.create({ ...form, status: 'enquiry' });
      setDone(true);
    } catch (err) {
      setError('Could not submit your job. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="flex justify-center">
          <CheckCircle size={56} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold">Job submitted!</h2>
        <p className="text-muted-foreground text-sm">
          Your request has been received. The CCG team will review it and be in touch shortly to arrange a quote or site visit.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setDone(false); setForm({ title: '', trade_category: '', site_postcode: '', site_address: '', start_date: '', end_date: '', urgency: 'medium', short_description: '', client_visible_notes: '' }); }}>
            Submit another
          </Button>
          <Button onClick={() => navigate('/')}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Submit a job</h1>
          <p className="text-sm text-muted-foreground">Tell us about the work you need doing</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job details</CardTitle>
            <CardDescription>What do you need doing?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job title *</Label>
              <Input
                id="title"
                required
                placeholder="e.g. New kitchen extension"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trade type *</Label>
                <Select required value={form.trade_category} onValueChange={(v) => set('trade_category', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={form.urgency} onValueChange={(v) => set('urgency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — flexible timing</SelectItem>
                    <SelectItem value="medium">Medium — within a few weeks</SelectItem>
                    <SelectItem value="high">High — within a week</SelectItem>
                    <SelectItem value="emergency">Emergency — ASAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="Please describe the work required, any access issues, materials needed, etc."
                rows={4}
                value={form.short_description}
                onChange={(e) => set('short_description', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Site location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Site address</Label>
              <Input
                id="address"
                placeholder="Full site address"
                value={form.site_address}
                onChange={(e) => set('site_address', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Site postcode *</Label>
              <Input
                id="postcode"
                required
                placeholder="e.g. SW1A 1AA"
                value={form.site_postcode}
                onChange={(e) => set('site_postcode', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferred dates</CardTitle>
            <CardDescription>When would you like the work done? (approximate is fine)</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Preferred start date</Label>
              <Input id="start" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Preferred end date</Label>
              <Input id="end" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Any additional notes?</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Access codes, parking, contact on site, anything else we should know…"
              rows={3}
              value={form.client_visible_notes}
              onChange={(e) => set('client_visible_notes', e.target.value)}
            />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/')}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Submitting…' : 'Submit job request'}
          </Button>
        </div>
      </form>
    </div>
  );
}