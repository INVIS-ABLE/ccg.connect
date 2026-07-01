import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, IdCard, ShieldCheck, Star, Wrench, MapPin, CalendarClock, Truck } from 'lucide-react';
import { cardStatus } from '@/domain/workforce/cardStatus';

const RTW_STATUSES = ['unchecked', 'checked', 'expired', 'restricted'];
const PAY_MODELS = ['', 'paye', 'cis', 'umbrella', 'limited'];
const STATUS_STYLE = {
  valid: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  expiring: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  none: 'bg-muted text-muted-foreground',
};

export default function WorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const now = new Date();
  const [worker, setWorker] = useState(null);
  const [cards, setCards] = useState([]);
  const [rtw, setRtw] = useState({ right_to_work_status: 'unchecked', rtw_check_date: '', rtw_checked_by: '', rtw_expiry: '', payment_model: '' });
  const [savingRtw, setSavingRtw] = useState(false);
  const [card, setCard] = useState({ card_type: '', reference: '', issuer: '', expiry_date: '' });
  const [busy, setBusy] = useState(false);
  const [perf, setPerf] = useState(null);
  const [deps, setDeps] = useState([]);

  const load = useCallback(async () => {
    const [w, cs, perfSummary, dp] = await Promise.all([
      api.workers.get(id).catch(() => null),
      api.workers.cards.list(id).catch(() => ({ cards: [] })),
      api.performance.summary(id).catch(() => null),
      api.workers.deployments(id).catch(() => ({ deployments: [] })),
    ]);
    if (w) {
      setWorker(w.worker);
      setRtw({
        right_to_work_status: w.worker.right_to_work_status ?? 'unchecked',
        rtw_check_date: w.worker.rtw_check_date ?? '',
        rtw_checked_by: w.worker.rtw_checked_by ?? '',
        rtw_expiry: w.worker.rtw_expiry ?? '',
        payment_model: w.worker.payment_model ?? '',
      });
    }
    setCards(cs.cards ?? []);
    setPerf(perfSummary);
    setDeps(dp.deployments ?? []);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveRtw() {
    setSavingRtw(true);
    try {
      await api.workers.update(id, rtw);
      await load();
    } finally {
      setSavingRtw(false);
    }
  }

  async function addCard(e) {
    e.preventDefault();
    if (!card.card_type.trim()) return;
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(card).filter(([, v]) => v.trim() !== ''));
      await api.workers.cards.create(id, { ...payload, card_type: card.card_type.trim() });
      setCard({ card_type: '', reference: '', issuer: '', expiry_date: '' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function verifyCard(c) {
    await api.workers.cards.update(id, c.id, { verification_status: 'verified' });
    await load();
  }

  if (!worker) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const LIVE_DEP = new Set(['proposed', 'confirmed', 'active']);
  const currentDeps = deps.filter((d) => LIVE_DEP.has(d.status));
  const pastDeps = deps.filter((d) => !LIVE_DEP.has(d.status));

  // Passport facts — only rendered when set, so the card stays tidy.
  const rate = (n, unit) => (n != null ? `£${n}/${unit}` : null);
  const facts = [
    ['Trade', worker.primary_trade],
    ['Skills', worker.additional_skills],
    ['Experience', worker.experience_years != null ? `${worker.experience_years} yr` : null],
    ['Plant tickets', worker.plant_tickets],
    ['Driving licence', worker.driving_licence],
    ['Travel radius', worker.preferred_travel_miles != null ? `${worker.preferred_travel_miles} mi` : null],
    ['Day rate', rate(worker.day_rate, 'day')],
    ['Hourly rate', rate(worker.hourly_rate, 'hr')],
    ['Available from', worker.available_from],
    ['Availability', worker.availability_note],
    ['Email', worker.email],
    ['Address', worker.home_address],
  ].filter(([, v]) => v != null && v !== '');

  const DepRow = ({ d }) => (
    <Link
      to={`/workforce/deployments/${d.id}`}
      className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm hover:bg-muted"
    >
      <MapPin size={13} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate">{d.site_name ?? d.request_title ?? 'Deployment'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {d.start_date ?? 'date TBC'}
          {d.finish_date ? ` – ${d.finish_date}` : ''}
          {d.site_postcode ? ` · ${d.site_postcode}` : ''}
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 capitalize">{d.status}</Badge>
    </Link>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/workforce/workers')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{worker.full_name}</h1>
          <p className="text-xs text-muted-foreground">
            {worker.primary_trade || 'Trade not set'}{worker.mobile ? ` · ${worker.mobile}` : ''}{worker.base_postcode ? ` · ${worker.base_postcode}` : ''}
          </p>
        </div>
        {perf && perf.count > 0 && perf.average != null && (
          <span
            className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-semibold"
            title={`${perf.count} client review${perf.count === 1 ? '' : 's'}${perf.would_repeat_rate != null ? ` · ${Math.round(perf.would_repeat_rate * 100)}% would use again` : ''}`}
          >
            <Star size={12} className="fill-amber-400 text-amber-400" /> {perf.average.toFixed(1)}
            <span className="text-muted-foreground">({perf.count})</span>
          </span>
        )}
        <Badge variant="secondary" className="capitalize">{worker.status}</Badge>
      </div>

      {/* Passport: profile, skills, availability & rates */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-sm"><Wrench size={14} /> Profile, skills &amp; rates</CardTitle></CardHeader>
        <CardContent>
          {facts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No profile details recorded yet.</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-dashed border-muted pb-1.5 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Right to work + payment model */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Right to work &amp; payment</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>RTW status</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm capitalize" value={rtw.right_to_work_status} onChange={(e) => setRtw({ ...rtw, right_to_work_status: e.target.value })}>
              {RTW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment model</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm uppercase" value={rtw.payment_model} onChange={(e) => setRtw({ ...rtw, payment_model: e.target.value })}>
              {PAY_MODELS.map((s) => <option key={s} value={s}>{s || '— not set —'}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Checked on</Label><Input type="date" value={rtw.rtw_check_date} onChange={(e) => setRtw({ ...rtw, rtw_check_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Recheck / expiry</Label><Input type="date" value={rtw.rtw_expiry} onChange={(e) => setRtw({ ...rtw, rtw_expiry: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Checked by</Label><Input value={rtw.rtw_checked_by} onChange={(e) => setRtw({ ...rtw, rtw_checked_by: e.target.value })} placeholder="Who verified the documents" /></div>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={saveRtw} disabled={savingRtw}>{savingRtw ? 'Saving…' : 'Save right-to-work'}</Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Record the actual check via the permitted Home Office / IDSP process — a document photo alone is not a valid check.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cards / qualifications */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cards &amp; qualifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cards.length === 0 && <p className="text-xs text-muted-foreground">No cards recorded yet.</p>}
          {cards.map((c) => {
            const status = cardStatus(c.expiry_date, now);
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
                <IdCard size={15} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.card_type}{c.reference ? <span className="ml-1 text-xs text-muted-foreground">· {c.reference}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">{c.expiry_date ? `Expires ${c.expiry_date}` : 'No expiry recorded'}{c.issuer ? ` · ${c.issuer}` : ''}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[status]}`}>{status}</span>
                {c.verification_status === 'verified' ? (
                  <Badge variant="secondary" className="gap-1"><ShieldCheck size={11} /> Verified</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => verifyCard(c)}>Verify</Button>
                )}
              </div>
            );
          })}
          <form onSubmit={addCard} className="grid gap-2 sm:grid-cols-4">
            <Input placeholder="Card / qual (CSCS, CPCS…)" value={card.card_type} onChange={(e) => setCard({ ...card, card_type: e.target.value })} />
            <Input placeholder="Reference" value={card.reference} onChange={(e) => setCard({ ...card, reference: e.target.value })} />
            <Input placeholder="Issuer" value={card.issuer} onChange={(e) => setCard({ ...card, issuer: e.target.value })} />
            <Input type="date" value={card.expiry_date} onChange={(e) => setCard({ ...card, expiry_date: e.target.value })} />
            <div className="sm:col-span-4"><Button type="submit" size="sm" disabled={busy} className="gap-1.5"><Plus size={14} /> Add card</Button></div>
          </form>
        </CardContent>
      </Card>

      {/* Deployments: current assignments + work history */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-1.5 text-sm"><Truck size={14} /> Deployments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarClock size={13} /> Current ({currentDeps.length})</p>
            {currentDeps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No current assignments.</p>
            ) : (
              currentDeps.map((d) => <DepRow key={d.id} d={d} />)
            )}
          </div>
          {pastDeps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Work history ({pastDeps.length})</p>
              {pastDeps.map((d) => <DepRow key={d.id} d={d} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
