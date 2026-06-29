import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Search, MessageSquare, Layers } from 'lucide-react';

const STAGES = [
  { key: 'enquiry',     label: 'Enquiry',     color: 'border-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  { key: 'quoted',      label: 'Quoted',      color: 'border-yellow-400', badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'confirmed',   label: 'Confirmed',   color: 'border-indigo-400', badge: 'bg-indigo-100 text-indigo-700' },
  { key: 'in_progress', label: 'In Progress', color: 'border-orange-400', badge: 'bg-orange-100 text-orange-700' },
  { key: 'completed',   label: 'Completed',   color: 'border-green-400',  badge: 'bg-green-100 text-green-700' },
];

export default function JobStatusBoard() {
  const [jobs, setJobs] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('board'); // board | list

  useEffect(() => {
    api.jobs.list().then((r) => setJobs(r.jobs ?? [])).catch(() => setJobs([]));
  }, []);

  const filtered = (jobs ?? []).filter(
    (j) => !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.site_postcode?.includes(search)
  ).filter((j) => j.status !== 'cancelled' && j.status !== 'draft');

  async function moveStage(job, newStatus) {
    try {
      await api.jobs.update(job.id, { status: newStatus });
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: newStatus } : j));
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Layers size={22} className="text-primary" /> Job Status Board
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All active jobs organised by current stage.</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input placeholder="Search jobs…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="flex gap-1 border rounded-md p-0.5 self-start">
          <button onClick={() => setView('board')} className={`px-3 py-1 text-sm rounded-sm transition-colors ${view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Board</button>
          <button onClick={() => setView('list')} className={`px-3 py-1 text-sm rounded-sm transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>List</button>
        </div>
      </div>

      {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}

      {/* Board view */}
      {jobs !== null && view === 'board' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {STAGES.map((stage) => {
            const stageJobs = filtered.filter((j) => j.status === stage.key);
            return (
              <div key={stage.key} className="space-y-2">
                <div className={`flex items-center justify-between border-l-4 pl-3 py-1 ${stage.color}`}>
                  <span className="font-semibold text-sm">{stage.label}</span>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full w-5 h-5 flex items-center justify-center font-medium">{stageJobs.length}</span>
                </div>
                {stageJobs.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-xs text-muted-foreground">No jobs</p>
                  </div>
                )}
                {stageJobs.map((j) => (
                  <JobCard key={j.id} job={j} stageMeta={stage} stages={STAGES} onMove={moveStage} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {jobs !== null && view === 'list' && (
        <Card>
          <CardContent className="pt-4">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No jobs found.</p>}
            <ul className="divide-y">
              {filtered.map((j) => {
                const stage = STAGES.find((s) => s.key === j.status);
                return (
                  <li key={j.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <Link to={`/jobs/${j.id}`} className="font-medium text-sm hover:underline text-primary">{j.title}</Link>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        {j.trade_category ?? '—'}
                        {j.site_postcode && <><MapPin size={10} />{j.site_postcode}</>}
                      </p>
                    </div>
                    {stage && (
                      <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 whitespace-nowrap ${stage.badge}`}>
                        {stage.label}
                      </span>
                    )}
                    <div className="flex gap-1">
                      <Link to={`/jobs/${j.id}`}>
                        <Button size="sm" variant="outline" className="text-xs">View</Button>
                      </Link>
                      <Link to={`/messages?job=${j.id}`}>
                        <Button size="sm" variant="ghost" className="text-xs flex items-center gap-1">
                          <MessageSquare size={12} /> Chat
                        </Button>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JobCard({ job, stageMeta, stages, onMove }) {
  const currentIdx = stages.findIndex((s) => s.key === job.status);
  const next = stages[currentIdx + 1];
  const prev = stages[currentIdx - 1];

  return (
    <Card className={`border-l-4 ${stageMeta.color}`}>
      <CardContent className="pt-3 pb-3 px-3 space-y-2">
        <Link to={`/jobs/${job.id}`} className="font-medium text-sm hover:underline text-primary line-clamp-2 leading-tight block">
          {job.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {job.trade_category ?? '—'}
          {job.site_postcode && <span className="ml-1 flex items-center gap-0.5 inline-flex"><MapPin size={9} />{job.site_postcode}</span>}
        </p>
        {job.start_date && (
          <p className="text-xs text-muted-foreground">Start: {new Date(job.start_date).toLocaleDateString('en-GB')}</p>
        )}
        <div className="flex items-center gap-1 flex-wrap pt-1">
          {prev && (
            <button onClick={() => onMove(job, prev.key)} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
              ← {prev.label}
            </button>
          )}
          <Link to={`/messages?job=${job.id}`} className="ml-auto">
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs flex items-center gap-1">
              <MessageSquare size={11} /> Chat
            </Button>
          </Link>
          {next && (
            <button onClick={() => onMove(job, next.key)} className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${stageMeta.badge} hover:opacity-80`}>
              → {next.label}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}