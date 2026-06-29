import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/app/auth/AuthProvider';
import { isAdminRole } from '@/domain/auth/roles';
import { serviceAreaCircle } from '@/domain/geo/geo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, MapPin, Star, ShieldCheck, ShieldOff, ArrowRight, RefreshCw } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const CoverageMap = lazy(() => import('@/components/map/CoverageMap'));

function ScoreBar({ label, value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ContractorMatchEngine() {
  const { principal } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [postcode, setPostcode] = useState('');
  const [matches, setMatches] = useState(null);
  const [jobGeo, setJobGeo] = useState(null);
  const [running, setRunning] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.jobs.list().then((r) => {
      const list = Array.isArray(r) ? r : r?.jobs ?? [];
      setJobs(list.filter((j) => !['completed', 'cancelled'].includes(j.status)));
    }).catch(() => {});
  }, []);

  // Map markers: the job (orange) + contractors that have coordinates.
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
    return { markers, center, circle: center ? serviceAreaCircle(center, 25) : null };
  }, [jobGeo, matches]);

  if (!isAdminRole(principal?.role)) return <Navigate to="/" replace />;

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  async function runMatch() {
    if (!selectedJobId) return;
    setRunning(true);
    setError(null);
    setMatches(null);
    setAssigned(null);
    try {
      const r = await api.match.forJob(selectedJobId);
      setMatches(r.matches ?? []);
      setJobGeo(r.job ?? null);
    } catch {
      setError('Could not run matching. Ensure contractors have postcodes and skills set.');
    } finally {
      setRunning(false);
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

  async function assign(contractorId) {
    setAssigning(contractorId);
    try {
      await api.assignments.create({ job_id: selectedJobId, contractor_id: contractorId });
      setAssigned(contractorId);
    } catch {
      setError('Could not assign contractor.');
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Zap size={22} className="text-primary" /> Contractor Matching Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rank available tradespeople by skill fit, proximity to site, and credential validity.
        </p>
      </div>

      {/* Job selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select a job to match</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <Label>Active job</Label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a job…" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} {j.site_postcode ? `· ${j.site_postcode}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:self-end">
            <Button
              onClick={runMatch}
              disabled={!selectedJobId || running}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Zap size={16} />
              {running ? 'Matching…' : matches ? 'Re-run match' : 'Run match'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Selected job summary */}
      {selectedJob && (
        <Card className="bg-muted/40">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{selectedJob.status}</Badge>
              {selectedJob.trade_category && <Badge variant="outline">{selectedJob.trade_category}</Badge>}
              {selectedJob.urgency && (
                <Badge variant={selectedJob.urgency === 'emergency' ? 'destructive' : 'outline'}>
                  {selectedJob.urgency}
                </Badge>
              )}
              {selectedJob.site_postcode && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={12} /> {selectedJob.site_postcode}
                </span>
              )}
              <Link
                to={`/jobs/${selectedJob.id}/match`}
                className="ml-auto text-xs text-primary flex items-center gap-1 hover:underline"
              >
                Open job-specific view <ArrowRight size={12} />
              </Link>
            </div>
            {selectedJob.short_description && (
              <p className="mt-2 text-sm text-muted-foreground">{selectedJob.short_description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scoring legend */}
      {!matches && !running && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Zap size={36} className="mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-sm">How scoring works</p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-xs text-muted-foreground text-left">
              {[
                { label: 'Skill match', max: 40, color: 'bg-blue-500', desc: 'How well trade skills align' },
                { label: 'Proximity', max: 30, color: 'bg-green-500', desc: 'Distance from site postcode' },
                { label: 'Credentials', max: 20, color: 'bg-purple-500', desc: 'Valid, in-date certifications' },
                { label: 'Preferred', max: 10, color: 'bg-amber-500', desc: 'Manually flagged contractors' },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className={`h-1.5 rounded-full ${s.color}`} />
                  <p className="font-semibold text-foreground">{s.label} <span className="text-muted-foreground font-normal">(/{s.max})</span></p>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {running && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground animate-pulse">Scoring contractors…</p>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Coverage map */}
      {Array.isArray(matches) && matches.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Coverage map</CardTitle>
            <Button variant="outline" size="sm" onClick={refreshLocations} disabled={geocoding || running} className="flex items-center gap-2">
              <RefreshCw size={14} className={geocoding ? 'animate-spin' : ''} />
              {geocoding ? 'Locating…' : 'Refresh locations'}
            </Button>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {Array.isArray(matches) && matches.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No approved contractors found for this job. Approve contractors and ensure they have skills and postcodes set.</p>
          </CardContent>
        </Card>
      )}

      {Array.isArray(matches) && matches.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">
            {matches.length} contractor{matches.length !== 1 ? 's' : ''} ranked
          </p>

          {matches.map((m, idx) => (
            <Card
              key={m.contractor_id}
              className={[
                !m.eligible && 'opacity-60',
                assigned === m.contractor_id && 'border-green-400 ring-1 ring-green-400',
              ].filter(Boolean).join(' ')}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Rank badge */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 && m.eligible ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
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
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {m.reasons?.map((r, i) => (
                          <span
                            key={i}
                            className={`text-xs rounded px-1.5 py-0.5 ${r.startsWith('✓') ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>

                      {/* Distance */}
                      {m.distanceMiles != null && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin size={11} /> {m.distanceMiles.toFixed(1)} miles from site
                        </p>
                      )}

                      {/* Score breakdown bars */}
                      {m.breakdown && (
                        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 max-w-xs">
                          <ScoreBar label="Skill" value={m.breakdown.skill} max={40} color="bg-blue-500" />
                          <ScoreBar label="Distance" value={m.breakdown.distance} max={30} color="bg-green-500" />
                          <ScoreBar label="Credentials" value={m.breakdown.credential} max={20} color="bg-purple-500" />
                          <ScoreBar label="Preferred" value={m.breakdown.preference} max={10} color="bg-amber-500" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assign action */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {assigned === m.contractor_id ? (
                      <Badge className="bg-green-600 text-white">Assigned ✓</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!m.eligible || assigning !== null}
                        onClick={() => assign(m.contractor_id)}
                      >
                        {assigning === m.contractor_id ? 'Assigning…' : 'Assign'}
                      </Button>
                    )}
                    <span className={`text-xs flex items-center gap-1 ${m.eligible ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {m.eligible ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
                      {m.eligible ? 'Eligible' : 'Not eligible'}
                    </span>
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