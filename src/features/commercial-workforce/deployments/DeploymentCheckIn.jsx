import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { MapPin, LogIn, LogOut, Clock, CheckCircle2, AlertTriangle, HardHat, ShieldCheck, ShieldAlert, FileBadge } from 'lucide-react';
import { WorkerKidDialog } from './WorkerKidDialog';

/** Best-effort browser geolocation — resolves to null if denied/unavailable so a
 *  check-in never blocks on location. Location is evidence, not a gate. */
function getLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy_m: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null);

/** Geofence indicator — green on-site / amber off-site. Renders nothing when the
 *  site has no geofence or no location was captured (geofence_ok is null). */
function GeoBadge({ record, className = '' }) {
  if (record?.geofence_ok == null) return null;
  return record.geofence_ok ? (
    <span className={`flex items-center gap-1 text-xs text-green-600 ${className}`}>
      <ShieldCheck size={12} /> On site
    </span>
  ) : (
    <span className={`flex items-center gap-1 text-xs text-amber-600 ${className}`}>
      <ShieldAlert size={12} /> {record.geofence_distance_m != null ? `~${Math.round(record.geofence_distance_m)}m off site` : 'Off site'}
    </span>
  );
}

/**
 * Mobile-first QR site check-in for a commercial deployment. A worker lands here
 * by scanning the site QR and taps to clock in/out (with optional location);
 * ops or the gang leader get a roster they can clock in kiosk-style. Records
 * attendance with method='qr' — roll-call always overrides (GPS is evidence,
 * never the sole truth).
 */
export default function DeploymentCheckIn() {
  const { id } = useParams();
  const { toast } = useToast();
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(null); // `${workerId}:${type}`
  const [kidOpen, setKidOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.deployments.checkin.context(id);
      setCtx(data);
      setForbidden(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else throw err;
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch {
        /* handled via forbidden / toast on action */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  async function record(type, workerId) {
    setBusy(`${workerId ?? 'me'}:${type}`);
    try {
      const loc = await getLocation();
      const { record: rec } = await api.deployments.checkin.record(id, { check_type: type, worker_id: workerId, ...(loc ?? {}) });
      const offSite = rec?.geofence_ok === false;
      toast({
        title: type === 'arrival' ? 'Checked in' : 'Checked out',
        description: offSite
          ? `Recorded — but you appear ${Math.round(rec.geofence_distance_m)}m from the site. Ops will see this.`
          : loc
            ? 'Time and location recorded.'
            : 'Time recorded (location unavailable).',
        variant: offSite ? 'destructive' : undefined,
      });
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.body?.error : null;
      toast({
        title: 'Could not record check-in',
        description:
          code === 'forbidden' || code === 'no_worker_for_user'
            ? "You're not on this deployment. Ask the office to confirm your assignment."
            : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>;

  if (forbidden || !ctx) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="font-semibold">Not your deployment</p>
            <p className="text-sm text-muted-foreground">
              This check-in is for the assigned team and site staff only. If you should have access, ask the
              office to confirm your assignment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { deployment, is_admin: isAdmin, roster, me_worker: meWorker, my_kid: myKid } = ctx;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F97316]/15 text-[#F97316]">
          <HardHat size={22} />
        </span>
        <h1 className="mt-2 text-xl font-bold">Site check-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {deployment.site_name ?? 'Site'}
          {deployment.site_postcode ? ` · ${deployment.site_postcode}` : ''}
        </p>
      </div>

      {/* Worker self check-in */}
      {!isAdmin && meWorker && (
        <Card>
          <CardContent className="space-y-4 py-6">
            <p className="text-center text-sm">
              {meWorker.full_name}
              {meWorker.check_in_time && (
                <span className="mt-1 flex items-center justify-center gap-1 text-xs text-green-600">
                  <CheckCircle2 size={13} /> On site since {fmtTime(meWorker.check_in_time)}
                  {meWorker.check_out_time && ` · left ${fmtTime(meWorker.check_out_time)}`}
                </span>
              )}
              <GeoBadge record={meWorker} className="mt-1 justify-center" />
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" className="h-16 flex-col gap-1" disabled={busy !== null} onClick={() => record('arrival')}>
                <LogIn size={20} />
                {busy === 'me:arrival' ? 'Saving…' : 'Check in'}
              </Button>
              <Button size="lg" variant="outline" className="h-16 flex-col gap-1" disabled={busy !== null} onClick={() => record('departure')}>
                <LogOut size={20} />
                {busy === 'me:departure' ? 'Saving…' : 'Check out'}
              </Button>
            </div>
            <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
              <MapPin size={12} /> Your location is recorded as site evidence when you allow it.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Worker's Key Information Document for this assignment */}
      {!isAdmin && myKid && (
        myKid.status === 'acknowledged' ? (
          <p className="flex items-center justify-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 size={13} /> Key Information Document acknowledged
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setKidOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-left dark:bg-amber-950/30"
          >
            <FileBadge size={18} className="shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-amber-800 dark:text-amber-300">Review your Key Information Document</span>
              <span className="block text-xs text-amber-700/80 dark:text-amber-400/80">Tap to read your assignment terms and acknowledge.</span>
            </span>
          </button>
        )
      )}

      {/* Admin / gang-leader roster (kiosk roll-call) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Team roll-call — tap to clock in/out</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!roster || roster.length === 0) && <p className="text-sm text-muted-foreground">No workers assigned yet.</p>}
            {roster?.map((w) => (
              <div key={w.worker_id} className="flex items-center gap-2 border-b py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.full_name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {w.check_in_time ? (
                      <>
                        <Clock size={11} /> In {fmtTime(w.check_in_time)}
                        {w.check_out_time && ` · Out ${fmtTime(w.check_out_time)}`}
                      </>
                    ) : (
                      'Not checked in'
                    )}
                  </p>
                  <GeoBadge record={w} className="mt-0.5" />
                </div>
                <Button size="sm" variant={w.check_in_time ? 'outline' : 'default'} disabled={busy !== null} onClick={() => record('arrival', w.worker_id)}>
                  {busy === `${w.worker_id}:arrival` ? '…' : 'In'}
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => record('departure', w.worker_id)}>
                  {busy === `${w.worker_id}:departure` ? '…' : 'Out'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <WorkerKidDialog kid={myKid} open={kidOpen} onClose={() => setKidOpen(false)} onAcknowledged={load} />
    </div>
  );
}
