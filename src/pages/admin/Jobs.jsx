import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { JOB_STATUSES } from '@/lib/roles';

const STATUS_FILTERS = ['all', 'draft', 'ready_to_match', 'offers_sent', 'assigned', 'in_progress', 'completed', 'cancelled'];

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    base44.entities.Job.filter({ archived: false }).then(data => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  const filtered = jobs.filter(j => {
    const matchSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.job_reference?.toLowerCase().includes(search.toLowerCase()) || j.site_postcode?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} total jobs`}
        actions={
          <Link to="/jobs/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> New Job
            </Button>
          </Link>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {s === 'all' ? 'All' : JOB_STATUSES[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <p>No jobs found</p>
              <Link to="/jobs/new"><Button variant="outline" size="sm" className="mt-3">Create first job</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(job => {
                const s = JOB_STATUSES[job.status];
                return (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold truncate">{job.title}</p>
                        {job.urgency === 'emergency' && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">URGENT</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{job.job_reference || 'No ref'} • {job.site_postcode || 'No postcode'}</p>
                    </div>
                    {s && <StatusBadge label={s.label} color={s.color} />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}