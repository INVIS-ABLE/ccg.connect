import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MapPin, Calendar } from 'lucide-react';
import { JOB_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';

export default function ContractorJobs() {
  const [assignments, setAssignments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    Promise.all([
      base44.entities.JobAssignment.list('-created_date', 100),
      base44.entities.Job.filter({ archived: false }),
    ]).then(([a, j]) => {
      setAssignments(a);
      setJobs(j);
      setLoading(false);
    });
  }, []);

  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
  const myAssignments = assignments.map(a => ({ ...a, job: jobMap[a.job_id] })).filter(a => a.job);
  const filtered = myAssignments.filter(a =>
    filter === 'all' ? true : filter === 'active' ? a.assignment_status === 'active' : a.assignment_status === filter
  );

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="My Jobs" />

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['active', 'completed', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No jobs found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const job = a.job;
            const s = JOB_STATUSES[job.status];
            return (
              <Link key={a.id} to={`/contractor/job/${job.id}`} className="block bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold">{job.title}</h3>
                  {s && <StatusBadge label={s.label} color={s.color} />}
                </div>
                {job.site_postcode && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3" />
                    {job.site_address || job.site_postcode}
                  </div>
                )}
                {a.planned_start && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    Start: {a.planned_start}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}