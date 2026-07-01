import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HardHat, MapPin, IdCard, FileBadge, LogIn, CheckCircle2, AlertTriangle, CalendarClock, Wallet } from 'lucide-react';

const gbp = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
const DEP_TONE = { active: 'default', confirmed: 'secondary', proposed: 'secondary', completed: 'outline' };
const CARD_TONE = {
  valid: 'text-green-700 dark:text-green-400',
  expiring: 'text-amber-700 dark:text-amber-400',
  expired: 'text-red-700 dark:text-red-400',
  none: 'text-muted-foreground',
};
const CARD_LABEL = { valid: 'Valid', expiring: 'Expiring soon', expired: 'Expired', none: 'No expiry' };
const fmtDate = (d) => (d ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/**
 * Worker self-service hub. A logged-in worker sees their own assignments,
 * credentials and Key Information Documents (all self-scoped server-side).
 */
export default function MyWork() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avail, setAvail] = useState({ available_from: '', availability_note: '' });
  const [savingAvail, setSavingAvail] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    api.portal.worker()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (data?.worker) setAvail({ available_from: data.worker.available_from ?? '', availability_note: data.worker.availability_note ?? '' });
  }, [data]);

  async function saveAvailability() {
    setSavingAvail(true);
    setAvailSaved(false);
    try {
      await api.portal.updateAvailability({ available_from: avail.available_from || null, availability_note: avail.availability_note || null });
      setAvailSaved(true);
    } finally {
      setSavingAvail(false);
    }
  }

  if (loading) return <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>;

  if (!data?.worker) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="font-semibold">No worker profile linked</p>
            <p className="text-sm text-muted-foreground">Your login isn&apos;t linked to a worker record yet. Ask the CCG office to connect it.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { worker, assignments, credentials, kids } = data;
  const kidByDep = new Map(kids.map((k) => [k.deployment_id, k]));

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F97316]/15 text-[#F97316]"><HardHat size={22} /></span>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{worker.full_name}</h1>
          <p className="text-xs text-muted-foreground">{worker.primary_trade || 'Trade not set'}</p>
        </div>
        {worker.right_to_work_status === 'checked' && (
          <Badge variant="secondary" className="gap-1"><CheckCircle2 size={12} className="text-green-600" /> Right to work</Badge>
        )}
      </div>

      {/* Assignments */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><HardHat size={15} /> My assignments</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {assignments.length === 0 && <p className="text-sm text-muted-foreground">No current assignments.</p>}
          {assignments.map((a) => {
            const kid = kidByDep.get(a.deployment_id);
            return (
              <div key={a.deployment_id} className="rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      <MapPin size={14} className="text-muted-foreground" /> {a.site_name || 'Site'}
                      {a.site_postcode ? <span className="text-xs text-muted-foreground">· {a.site_postcode}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.role ? `${a.role} · ` : ''}{fmtDate(a.start_date) || 'TBC'}{a.finish_date ? ` – ${fmtDate(a.finish_date)}` : ''}
                    </p>
                  </div>
                  <Badge variant={DEP_TONE[a.status] ?? 'secondary'} className="capitalize">{a.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(a.status === 'active' || a.status === 'confirmed') && (
                    <Link to={`/checkin/deployment/${a.deployment_id}`}>
                      <Button size="sm" className="gap-1.5"><LogIn size={13} /> Check in</Button>
                    </Link>
                  )}
                  {kid && kid.status === 'issued' && (
                    <Link to={`/checkin/deployment/${a.deployment_id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 dark:text-amber-300">
                        <FileBadge size={13} /> Review your KID
                      </Button>
                    </Link>
                  )}
                  {kid && kid.status === 'acknowledged' && (
                    <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> KID acknowledged</span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><IdCard size={15} /> My cards &amp; qualifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {credentials.length === 0 && <p className="text-sm text-muted-foreground">No cards recorded yet.</p>}
          {credentials.map((card) => (
            <div key={card.id} className="flex items-center gap-3 border-b py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{card.card_type}{card.reference ? <span className="text-muted-foreground"> · {card.reference}</span> : ''}</p>
                <p className="text-xs text-muted-foreground">{card.issuer || ''}{card.expiry_date ? ` · expires ${fmtDate(card.expiry_date)}` : ''}</p>
              </div>
              <span className={`text-xs font-medium ${CARD_TONE[card.status]}`}>{CARD_LABEL[card.status]}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Availability (worker-editable) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CalendarClock size={15} /> My availability</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Available from</Label>
              <Input type="date" value={avail.available_from} onChange={(e) => { setAvail({ ...avail, available_from: e.target.value }); setAvailSaved(false); }} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={avail.availability_note} onChange={(e) => { setAvail({ ...avail, availability_note: e.target.value }); setAvailSaved(false); }} placeholder="e.g. Available weekdays; not Fridays. Happy to travel up to 30 miles." />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveAvailability} disabled={savingAvail}>{savingAvail ? 'Saving…' : 'Save availability'}</Button>
            {availSaved && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={13} /> Saved</span>}
          </div>
        </CardContent>
      </Card>

      {/* Pay history (their own pay only) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet size={15} /> My pay history</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(!data.pay || data.pay.length === 0) && <p className="text-sm text-muted-foreground">No pay recorded yet.</p>}
          {data.pay?.map((p, i) => (
            <div key={`${p.week_start}-${i}`} className="flex items-center gap-3 border-b py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Week of {fmtDate(p.week_start)}</p>
                <p className="text-xs text-muted-foreground">{p.basic_hours}h{p.overtime_hours ? ` + ${p.overtime_hours}h OT` : ''} · {p.status.replace('_', ' ')}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{gbp(p.pay)}</span>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-muted-foreground">Your pay before any statutory deductions — payroll confirms the final figure.</p>
        </CardContent>
      </Card>
    </div>
  );
}
