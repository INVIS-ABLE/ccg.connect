import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Briefcase, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { JOB_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';

export default function ContractorHome() {
  const [assignments, setAssignments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(me => {
      setUser(me);
      return Promise.all([
        base44.entities.JobAssignment.filter({ assignment_status: 'active' }),
        base44.entities.Job.filter({ archived: false }),
        base44.entities.Timesheet.filter({ status: 'draft' }),
      ]);
    }).then(([a, j, t]) => {
      setAssignments(a);
      setJobs(j);
      setTimesheets(t);
      setLoading(false);
    });
  }, []);

  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
  const myJobs = assignments.map(a => ({ ...a, job: jobMap[a.job_id] })).filter(a => a.job);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">{user?.full_name || user?.email}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Active Jobs', value: myJobs.length, color: 'text-primary' },
          { label: 'Draft Timesheets', value: timesheets.length, color: 'text-amber-600' },
          { label: 'Completed', value: assignments.filter(a => a.assignment_status === 'completed').length, color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">My Active Jobs</h2>
          <Link to="/contractor/jobs" className="text-xs text-primary flex items-center gap-1">
            All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
        ) : myJobs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No active jobs</div>
        ) : (
          <div className="divide-y divide-border">
            {myJobs.slice(0, 4).map(a => {
              const s = JOB_STATUSES[a.job.status];
              return (
                <Link key={a.id} to={`/contractor/jobs/${a.job_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.job.title}</p>
                    <p className="text-xs text-muted-foreground">{a.job.site_postcode || 'No postcode'}</p>
                  </div>
                  {s && <StatusBadge label={s.label} color={s.color} />}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {timesheets.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Draft Timesheets</span>
          </div>
          <p className="text-xs text-amber-700 mb-3">You have {timesheets.length} timesheet{timesheets.length > 1 ? 's' : ''} to complete</p>
          <Link to="/contractor/timesheets" className="text-xs text-amber-800 font-medium underline">Complete now →</Link>
        </div>
      )}
    </div>
  );
}