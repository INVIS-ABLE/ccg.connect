import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Briefcase, HardHat, ShieldCheck, Clock, AlertTriangle, ArrowRight, Users } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import PageHeader from '@/components/shared/PageHeader';
import { JOB_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';
import ExpiringCredentialsPanel from '@/components/dashboard/ExpiringCredentialsPanel';
import JobScheduleCalendar from '@/components/dashboard/JobScheduleCalendar';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Job.filter({ archived: false }),
      base44.entities.ContractorProfile.filter({ archived: false }),
      base44.entities.Timesheet.filter({ status: 'submitted' }),
      base44.entities.ContractorCredential.filter({ verification_status: 'awaiting_review', archived: false }),
    ]).then(([j, c, t, cr]) => {
      setJobs(j);
      setContractors(c);
      setTimesheets(t);
      setCredentials(cr);
      setLoading(false);
    });
  }, []);

  const activeJobs = jobs.filter(j => ['in_progress', 'assigned', 'offers_sent'].includes(j.status));
  const urgentJobs = jobs.filter(j => j.urgency === 'emergency' && !['completed', 'cancelled'].includes(j.status));
  const pendingContractors = contractors.filter(c => c.approval_status === 'pending');
  const approvedContractors = contractors.filter(c => c.approval_status === 'approved');

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Command Centre"
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* Alert Banner */}
      {(urgentJobs.length > 0 || credentials.length > 0 || timesheets.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Action Required</span>
          </div>
          <div className="space-y-1">
            {urgentJobs.length > 0 && (
              <p className="text-xs text-amber-700">• {urgentJobs.length} emergency job{urgentJobs.length > 1 ? 's' : ''} need immediate attention</p>
            )}
            {credentials.length > 0 && (
              <p className="text-xs text-amber-700">• {credentials.length} credential{credentials.length > 1 ? 's' : ''} awaiting review</p>
            )}
            {timesheets.length > 0 && (
              <p className="text-xs text-amber-700">• {timesheets.length} timesheet{timesheets.length > 1 ? 's' : ''} pending approval</p>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Jobs" value={activeJobs.length} icon={Briefcase} subtitle={`${jobs.filter(j => j.status === 'ready_to_match').length} ready to match`} />
        <StatCard title="Contractors" value={approvedContractors.length} icon={HardHat} subtitle={`${pendingContractors.length} pending approval`} color="text-blue-600" />
        <StatCard title="Pending Timesheets" value={timesheets.length} icon={Clock} subtitle="Awaiting your approval" color="text-amber-600" />
        <StatCard title="Credential Reviews" value={credentials.length} icon={ShieldCheck} subtitle="Awaiting review" color="text-red-600" />
      </div>

      {/* Job Schedule Calendar */}
      <div className="mb-6">
        <JobScheduleCalendar jobs={jobs} />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Recent Jobs</h2>
            <Link to="/jobs" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {jobs.slice(0, 6).map(job => {
              const s = JOB_STATUSES[job.status];
              return (
                <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors" onClick={e => e.stopPropagation()}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.site_postcode || 'No postcode'}</p>
                  </div>
                  {s && <StatusBadge label={s.label} color={s.color} />}
                </Link>
              );
            })}
            {jobs.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No jobs yet</div>
            )}
          </div>
        </div>

        {/* Expiring Credentials + Quick Actions + Pending Items */}
        <div className="space-y-6">
        <ExpiringCredentialsPanel />
          {/* Pending Contractors */}
          {pendingContractors.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-sm">Pending Contractor Approvals</h2>
                <Link to="/contractors?status=pending" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-border">
                {pendingContractors.slice(0, 4).map(c => (
                  <Link key={c.id} to={`/contractors/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <HardHat className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.trading_name || c.legal_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{c.primary_trade || 'Trade not set'}</p>
                    </div>
                    <span className="text-xs text-amber-600 font-medium">Review</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Timesheets */}
          {timesheets.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-sm">Timesheets to Approve</h2>
                <Link to="/timesheets?status=submitted" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-border">
                {timesheets.slice(0, 4).map(t => (
                  <Link key={t.id} to={`/timesheets/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Week of {t.week_start}</p>
                      <p className="text-xs text-muted-foreground">{t.total_hours ? `${t.total_hours}h` : 'Hours TBC'}</p>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">Approve</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Nav */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold text-sm mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/jobs/new', label: 'Create Job', icon: Briefcase },
                { to: '/contractors/new', label: 'Add Contractor', icon: HardHat },
                { to: '/clients/new', label: 'Add Client', icon: Users },
                { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
              ].map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm font-medium">
                  <Icon className="w-4 h-4 text-primary" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}