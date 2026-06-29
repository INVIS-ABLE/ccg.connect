import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { serviceAreaCircle } from '@/domain/geo/geo';
import { ArrowLeft, Star, MapPin, ShieldCheck, ShieldOff, Zap, RefreshCw } from 'lucide-react';

// Lazy so MapLibre stays out of the main bundle.
const CoverageMap = lazy(() => import('@/components/map/CoverageMap'));

function ScoreBar({ label, value, max = 40, color = 'bg-primary' }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MatchEngine() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [matches, setMatches] = useState(null);
  const [jobGeo, setJobGeo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.jobs.get(id).then((r) => setJob(r.job)).catch(() => setError('Could not load job.'));
  }, [id]);

  async function runMatch() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.match.forJob(id);
      setMatches(r.matches);
      setJobGeo(r.job);
    } catch {
      setError('Could not run matching — check contractors have postcodes set.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshLocations() {
    setGeocoding(true);
    setError(null);
    try {
      await api.match.geocodeBackfill();
      await runMatch();
    } catch {
      setError('Could not refresh map locations.');
    } finally {
      setGeocoding(false);
    }
  }

  // Map markers: the job (orange) + contractors that have coordinates
  // (green = eligible, grey = not).
  const mapData = useMemo(() => {
    const markers = [];
    const center =
      jobGeo?.latitude != null && jobGeo?.longitude != null
        ? { lng: jobGeo.longitude, lat: jobGeo.latitude }
        : null;
    if (center) markers.push({ id: 'job', lng: center.lng, lat: center.lat, color: '#f97316', label: jobGeo.title ?? 'Job site' });
    for (const m of matches ?? []) {
      if (m.latitude != null && m.longitude != null) {
        markers.push({
          id: m.contractor_id,
          lng: m.longitude,
          lat: m.latitude,
          color: m.eligible ? '#16a34a' : '#9ca3af',
          label: `${m.trading_name ?? 'Contractor'}${m.distanceMiles != null ? ` · ${m.distanceMiles} mi` : ''}`,
        });
      }
    }
    const circle = center ? serviceAreaCircle(center, 25) : null;
    return { markers, center, circle, hasContractorPins: markers.length > (center ? 1 : 0) };
  }, [jobGeo, matches]);

  async function assign(contractorId) {
    setAssigning(contractorId);
    try {
      await api.assignments.create({ job_id: id, contractor_id: contractorId });
      setAssigned(contractorId);
    } catch {
      setError('Could not assign contractor.');
    } finally {
      setAssigning(null);
    }
  }

  if (error && !job) return <p className="text-sm text-destructive">{error}</p>;
  if (!job) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Contractor matching</h1>
          <p className="text-sm text-muted-foreground">{job.title} · {job.site_postcode ?? 'No postcode'}</p>
        </div>
      </div>

      {/* Job summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{job.status}</Badge>
            {job.trade_category && <Badge variant="outline">{job.trade_category}</Badge>}
            {job.urgency && <Badge variant={job.urgency === 'emergency' ? 'destructive' : 'outline'}>{job.urgency}</Badge>}
            {job.site_postcode && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={12} /> {job.site_postcode}
              </span>
            )}
          </div>
          {job.short_description && (
            <p className="mt-2 text-sm text-muted-foreground">{job.short_description}</p>
          )}
        </CardContent>
      </Card>

      {/* Run match */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Contractors are ranked by skill match, distance, credential validity, and preferred status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {matches && (
            <Button variant="outline" onClick={refreshLocations} disabled={geocoding || loading} className="flex items-center gap-2">
              <RefreshCw size={15} className={geocoding ? 'animate-spin' : ''} />
              {geocoding ? 'Locating…' : 'Refresh locations'}
            </Button>
          )}
          <Button onClick={runMatch} disabled={loading} className="flex items-center gap-2">
            <Zap size={16} />
            {loading ? 'Matching…' : matches ? 'Re-run match' : 'Run match'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Coverage map: job + contractor locations */}
      {Array.isArray(matches) && matches.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            {mapData.center ? (
              <Suspense fallback={<div className="h-[360px] rounded-lg border bg-muted/30" />}>
                <CoverageMap center={mapData.center} markers={mapData.markers} circle={mapData.circle} />
              </Suspense>
            ) : (
              <p className="text-sm text-muted-foreground">
                No map locations yet. Click <span className="font-medium">Refresh locations</span> to geocode the job
                and contractor postcodes.
              </p>
            )}
            {mapData.center && !mapData.hasContractorPins && (
              <p className="mt-2 text-xs text-muted-foreground">
                Contractor pins appear once their postcodes are geocoded — click <span className="font-medium">Refresh locations</span>.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {matches === null && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Click "Run match" to rank available contractors for this job.</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Scoring contractors…</p>
          </CardContent>
        </Card>
      )}

      {Array.isArray(matches) && matches.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No approved contractors found. Approve contractors first.</p>
          </CardContent>
        </Card>
      )}

      {Array.isArray(matches) && matches.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{matches.length} contractor{matches.length !== 1 ? 's' : ''} ranked</p>
          {matches.map((m, idx) => (
            <Card key={m.contractor_id} className={!m.eligible ? 'opacity-60' : assigned === m.contractor_id ? 'border-green-400' : ''}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {/* Rank badge */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 && m.eligible ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{m.trading_name ?? m.contractor_id}</span>
                        {m.eligible ? (
                          <Badge className="text-xs">Score {m.totalScore}</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Ineligible</Badge>
                        )}
                        {m.breakdown?.preference > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-500">
                            <Star size={12} fill="currentColor" /> Preferred
                          </span>
                        )}
                      </div>

                      {/* Reason pills */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.reasons.map((r, i) => (
                          <span key={i} className={`text-xs rounded px-1.5 py-0.5 ${r.startsWith('✓') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                            {r}
                          </span>
                        ))}
                      </div>

                      {/* Distance */}
                      {m.distanceMiles !== null && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin size={11} /> {m.distanceMiles.toFixed(1)} miles away
                        </p>
                      )}

                      {/* Score breakdown */}
                      {m.breakdown && (
                        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 max-w-xs">
                          <ScoreBar label="Skill" value={m.breakdown.skill} max={40} color="bg-blue-500" />
                          <ScoreBar label="Distance" value={m.breakdown.distance} max={30} color="bg-green-500" />
                          <ScoreBar label="Credentials" value={m.breakdown.credential} max={20} color="bg-purple-500" />
                          <ScoreBar label="Preferred" value={m.breakdown.preference} max={10} color="bg-amber-500" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    {assigned === m.contractor_id ? (
                      <Badge className="bg-green-600">Assigned ✓</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!m.eligible || assigning !== null}
                        onClick={() => assign(m.contractor_id)}
                      >
                        {assigning === m.contractor_id ? 'Assigning…' : 'Assign'}
                      </Button>
                    )}
                    {!m.eligible && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShieldOff size={11} /> Not eligible
                      </span>
                    )}
                    {m.eligible && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <ShieldCheck size={11} /> Eligible
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}