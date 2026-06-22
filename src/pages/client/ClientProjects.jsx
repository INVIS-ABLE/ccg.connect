import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MapPin, Calendar } from 'lucide-react';
import { JOB_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';

export default function ClientProjects() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    base44.entities.Job.filter({ archived: false }).then(j => {
      setJobs(j);
      setLoading(false);
    });
  }, []);

  const filtered = jobs.filter(j =>
    filter === 'all' ? true :
    filter === 'active' ? !['completed', 'cancelled'].includes(j.status) :
    j.status === filter
  );

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="My Projects" />

      <div className="flex gap-1.5 mb-4">
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
        <div className="py-16 text-center text-sm text-muted-foreground">No projects found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => {
            const s = JOB_STATUSES[job.status];
            return (
              <Link key={job.id} to={`/client/projects/${job.id}`} className="block bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold">{job.title}</h3>
                  {s && <StatusBadge label={s.label} color={s.color} />}
                </div>
                {job.site_address && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <MapPin className="w-3 h-3" />
                    {job.site_address}
                  </div>
                )}
                {job.start_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    Start: {job.start_date}
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