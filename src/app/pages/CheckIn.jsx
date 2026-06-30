import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { MapPin, LogIn, LogOut, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

/** Best-effort browser geolocation. Resolves to null if denied/unavailable so a
 *  check-in never blocks on location — it's evidence, not a gate. */
function getLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Mobile-first on-site check-in. A contractor lands here by scanning the job's
 * QR code; one tap records their arrival/departure with (optional) location.
 */
export default function CheckIn() {
  const { jobId } = useParams();
  const { toast } = useToast();
  const [job, setJob] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null); // 'arrival' | 'departure'

  const loadCheckins = useCallback(async () => {
    try {
      const r = await api.checkins.list(jobId);
      setCheckins(r.checkins ?? []);
      setForbidden(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
    }
  }, [jobId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Job title is best-effort — the check-in list is the source of truth for access.
      try {
        const r = await api.jobs.get(jobId);
        if (alive) setJob(r.job);
      } catch {
        /* a contractor may not be able to read the full job; that's fine */
      }
      await loadCheckins();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [jobId, loadCheckins]);

  async function check(type) {
    setBusy(type);
    try {
      const loc = await getLocation();
      await api.checkins.create({
        job_id: jobId,
        check_type: type,
        note: note.trim() || undefined,
        ...(loc ?? {}),
      });
      setNote('');
      toast({
        title: type === 'arrival' ? 'Checked in' : 'Checked out',
        description: loc ? 'Time and location recorded.' : 'Time recorded (location unavailable).',
      });
      await loadCheckins();
    } catch (err) {
      const code = err instanceof ApiError ? err.body?.error : null;
      toast({
        title: 'Could not check in',
        description:
          code === 'forbidden'
            ? "You're not assigned to this job."
            : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="font-semibold">Not your job</p>
            <p className="text-sm text-muted-foreground">
              This check-in is for the assigned team only. If you should have access, ask the office to
              confirm your assignment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold">Site check-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {job ? job.title : 'Job'}
          {job?.site_postcode ? ` · ${job.site_postcode}` : ''}
        </p>
      </div>

      <Input
        placeholder="Add a note (optional) — e.g. arrived, materials on site"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" className="h-16 flex-col gap-1" disabled={busy !== null} onClick={() => check('arrival')}>
          <LogIn size={20} />
          {busy === 'arrival' ? 'Saving…' : 'Check in'}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-16 flex-col gap-1"
          disabled={busy !== null}
          onClick={() => check('departure')}
        >
          <LogOut size={20} />
          {busy === 'departure' ? 'Saving…' : 'Check out'}
        </Button>
      </div>
      <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <MapPin size={12} /> Your location is recorded as site evidence when you allow it.
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent check-ins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checkins.length === 0 && <p className="text-sm text-muted-foreground">No check-ins yet.</p>}
          {checkins.map((ci) => (
            <div key={ci.id} className="flex items-start gap-2 border-b pb-2 last:border-0 last:pb-0">
              {ci.check_type === 'arrival' ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              ) : (
                <LogOut size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {ci.user_name} · {ci.check_type === 'arrival' ? 'Arrived' : 'Left'}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={11} /> {fmt(ci.checked_in_at)}
                  {ci.latitude != null && ci.longitude != null && (
                    <a
                      className="ml-1 inline-flex items-center gap-0.5 text-primary underline"
                      href={`https://www.google.com/maps?q=${ci.latitude},${ci.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={11} /> map
                    </a>
                  )}
                </p>
                {ci.note && <p className="text-xs text-muted-foreground">“{ci.note}”</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
