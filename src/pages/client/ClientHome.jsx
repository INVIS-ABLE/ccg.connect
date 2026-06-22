import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Briefcase, FileText, ArrowRight } from 'lucide-react';
import { JOB_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';

export default function ClientHome() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(me => {
      setUser(me);
      return base44.entities.Job.filter({ archived: false });
    }).then(j => {
      setJobs(j);
      setLoading(false);
    });
  }, []);

  const activeJobs = jobs.filter(j => !['completed', 'cancelled'].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === 'completed');

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">{user?.full_name || user?.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-primary">{activeJobs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active Projects</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{completedJobs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Active Projects</h2>
          <Link to="/client/projects" className="text-xs text-primary flex items-center gap-1">
            All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
        ) : activeJobs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No active projects</div>
        ) : (
          <div className="divide-y divide-border">
            {activeJobs.slice(0, 5).map(job => {
              const s = JOB_STATUSES[job.status];
              return (
                <Link key={job.id} to={`/client/projects/${job.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.site_postcode || 'No postcode'}</p>
                  </div>
                  {s && <StatusBadge label={s.label} color={s.color} />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}