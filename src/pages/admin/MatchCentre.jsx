import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Target, ChevronRight, Zap, MapPin, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import { JOB_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right">{score}%</span>
    </div>
  );
}

function ReasonTag({ text }) {
  const isNeg = text.includes('-');
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${isNeg ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      {text}
    </span>
  );
}

export default function MatchCentre() {
  const [jobs, setJobs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [expandedMatch, setExpandedMatch] = useState(null);

  const load = async () => {
    const [j, c, m] = await Promise.all([
      base44.entities.Job.filter({ archived: false }),
      base44.entities.ContractorProfile.filter({ approval_status: 'approved', archived: false }),
      base44.entities.JobMatch.list('-created_date', 200),
    ]);
    setJobs(j.filter(job => ['ready_to_match', 'offers_sent', 'draft'].includes(job.status)));
    setContractors(c);
    setMatches(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runMatch = async () => {
    if (!selectedJob) return;
    setRunning(true);
    try {
      await base44.functions.invoke('matchContractors', { job_id: selectedJob.id });
      toast.success('Matching complete — rankings updated');
      const m = await base44.entities.JobMatch.list('-created_date', 200);
      setMatches(m);
    } catch (e) {
      toast.error('Matching failed: ' + e.message);
    }
    setRunning(false);
  };

  const handleAssign = async (contractorId, contractorName) => {
    if (!selectedJob) return;
    setAssigning(contractorId);
    await base44.entities.JobAssignment.create({
      job_id: selectedJob.id,
      contractor_id: contractorId,
      assignment_status: 'active',
      assigned_at: new Date().toISOString(),
    });
    await base44.entities.Job.update(selectedJob.id, { status: 'assigned' });
    toast.success(`${contractorName} assigned to job`);
    setJobs(prev => prev.filter(j => j.id !== selectedJob.id));
    setSelectedJob(null);
    setAssigning(null);
  };

  const jobMatches = selectedJob
    ? matches
        .filter(m => m.job_id === selectedJob.id)
        .map(m => ({ match: m, contractor: contractors.find(c => c.id === m.contractor_id) }))
        .filter(x => x.contractor)
        .sort((a, b) => (b.match.match_score || 0) - (a.match.match_score || 0))
    : [];

  if (loading) return <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Match Centre" subtitle="AI-powered contractor ranking by skill, distance & availability" />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Jobs */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Jobs Awaiting Match ({jobs.length})</h2>
          </div>
          {jobs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No jobs awaiting matching</div>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map(job => {
                const s = JOB_STATUSES[job.status];
                const matchCount = matches.filter(m => m.job_id === job.id).length;
                return (
                  <button
                    key={job.id}
                    onClick={() => { setSelectedJob(job); setExpandedMatch(null); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selectedJob?.id === job.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/50'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{job.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{job.site_postcode || 'No postcode'} • {job.trade_category || 'Any trade'}</span>
                        {matchCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{matchCount} matched</span>}
                      </div>
                    </div>
                    {s && <StatusBadge label={s.label} color={s.color} />}
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Matches */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm truncate">
              {selectedJob ? `Matches: ${selectedJob.title}` : 'Select a job'}
            </h2>
            {selectedJob && (
              <Button size="sm" onClick={runMatch} disabled={running} className="bg-[#F97316] hover:bg-[#ea6a0a] text-white gap-1.5 flex-shrink-0">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {running ? 'Running…' : 'Run Match'}
              </Button>
            )}
          </div>

          {!selectedJob ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex-1">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Select a job to view ranked contractors
            </div>
          ) : jobMatches.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex-1">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No matches yet.</p>
              <p className="text-xs mt-1">Click "Run Match" to rank contractors for this job.</p>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-y-auto">
              {jobMatches.map(({ match, contractor }, idx) => {
                const name = contractor.trading_name || contractor.legal_name || 'Unnamed';
                const reasons = (match.match_reasons || '').split(';').map(r => r.trim()).filter(Boolean);
                const isExpanded = expandedMatch === match.id;
                return (
                  <div key={match.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Rank badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {match.distance_miles != null && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />{match.distance_miles}mi
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground capitalize flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />{contractor.availability_status?.replace('_', ' ') || 'Unknown'}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <ScoreBar score={match.match_score || 0} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleAssign(contractor.id, name)}
                          disabled={assigning === contractor.id}
                          className="text-xs h-7"
                        >
                          {assigning === contractor.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Assign'}
                        </Button>
                        <button
                          onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && reasons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 pl-10">
                        {reasons.map((r, i) => <ReasonTag key={i} text={r} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}