import { useEffect, useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, CheckCircle2, LogOut, RefreshCw } from 'lucide-react';

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Admin-side panel: the job's QR check-in code (contractors scan it on site to
 * clock in/out) plus the live check-in history. The QR points at the in-app
 * /checkin/:jobId route, which is permission-checked server-side.
 */
export function JobCheckinPanel({ jobId }) {
  const checkinUrl = `${window.location.origin}/checkin/${jobId}`;
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.checkins.list(jobId);
      setCheckins(r.checkins ?? []);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  function printQr() {
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return;
    const canvas = document.getElementById(`qr-${jobId}`);
    const dataUrl = canvas?.toDataURL?.('image/png') ?? '';
    win.document.write(
      `<html><head><title>Site check-in QR</title></head><body style="font-family:sans-serif;text-align:center;padding:24px">
        <h2>Scan to check in on site</h2>
        <img src="${dataUrl}" style="width:280px;height:280px" />
        <p style="color:#555;font-size:13px">${checkinUrl}</p>
      </body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
      {/* QR */}
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-lg border bg-white p-3">
          <QRCodeCanvas id={`qr-${jobId}`} value={checkinUrl} size={140} includeMargin />
        </div>
        <Button size="sm" variant="outline" onClick={printQr}>
          Print QR
        </Button>
        <p className="max-w-[160px] text-center text-[11px] text-muted-foreground">
          Contractors scan this on site to clock in / out.
        </p>
      </div>

      {/* History */}
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-in history</h4>
          <button onClick={load} className="text-muted-foreground hover:text-foreground" aria-label="Refresh check-ins">
            <RefreshCw size={13} />
          </button>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && checkins.length === 0 && (
          <p className="text-sm text-muted-foreground">No check-ins yet.</p>
        )}
        <div className="space-y-2">
          {checkins.map((ci) => (
            <div key={ci.id} className="flex items-start gap-2 border-b pb-2 text-sm last:border-0 last:pb-0">
              {ci.check_type === 'arrival' ? (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" />
              ) : (
                <LogOut size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {ci.user_name} · {ci.check_type === 'arrival' ? 'Arrived' : 'Left'}
                </p>
                <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={11} /> {fmt(ci.checked_in_at)}
                  {ci.latitude != null && ci.longitude != null && (
                    <a
                      className="inline-flex items-center gap-0.5 text-primary underline"
                      href={`https://www.google.com/maps?q=${ci.latitude},${ci.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={11} /> location
                    </a>
                  )}
                </p>
                {ci.note && <p className="text-xs text-muted-foreground">“{ci.note}”</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
