import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Users, Clock, AlertTriangle, CheckCircle, CalendarDays, GanttChart } from 'lucide-react';
import JobGantt from '@/app/components/JobGantt';
import AdminJobCalendar from '@/app/components/AdminJobCalendar';

const STATUS_COLOR = {
  draft: 'bg-gray-200 text-gray-700',
  enquiry: 'bg-blue-100 text-blue-700',
  quoted: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function statusClass(s) {
  return STATUS_COLOR[s] ?? 'bg-gray-100 text-gray-600';
}

export default function AdminDashboard() {
  const [jobs, setJobs] = useState(null);
  const [timesheets, setTimesheets] = useState(null);
  const [contractors, setContractors] = useState(null);
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    api.jobs.list().then((r) => setJobs(r.jobs)).catch(() => setJobs([]));
    api.timesheets.list().then((r) => setTimesheets(r.timesheets)).catch(() => setTimesheets([]));
    api.contractors.list().then((r) => setContractors(r.contractors)).catch(() => setContractors([]));
    api.credentials.awaiting().then((r) => setCredentials(r.credentials)).catch(() => setCredentials([]));
  }, []);

  const activeJobs = jobs?.filter((j) => j.status === 'in_progress') ?? [];
  const enquiries = jobs?.filter((j) => j.status === 'enquiry') ?? [];
  const pendingTimesheets = timesheets?.filter((t) => t.status === 'submitted') ?? [];
  const pendingContractors = contractors?.filter((c) => c.approval_status === 'pending') ?? [];
  const upcomingJobs = jobs
    ?.filter((j) => j.start_date && j.status !== 'completed' && j.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations Dashboard</h1>
        <p className="text-muted-foreground text-sm">CCG Connect — Admin view</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Briefcase size={18} />} label="Active jobs" value={activeJobs.length} color="text-orange-500" loading={jobs === null} />
        <StatCard icon={<AlertTriangle size={18} />} label="Enquiries" value={enquiries.length} color="text-blue-500" loading={jobs === null} />
        <StatCard icon={<Clock size={18} />} label="Pending timesheets" value={pendingTimesheets.length} color="text-amber-500" loading={timesheets === null} />
        <StatCard icon={<Users size={18} />} label="Awaiting approval" value={pendingContractors.length} color="text-red-500" loading={contractors === null} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending timesheets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Pending timesheet approvals</CardTitle>
            <Link to="/compliance">
              <Button variant="ghost" size="sm" className="text-xs">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {timesheets === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {timesheets !== null && pendingTimesheets.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle size={16} /> All timesheets reviewed
              </div>
            )}
            {pendingTimesheets.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">Week of {t.week_start}</p>
                  <p className="text-xs text-muted-foreground">{t.total_hours ?? '—'} hrs · £{t.total_amount ?? '—'}</p>
                </div>
                <Badge variant="secondary">Submitted</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* New contractor applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Contractor applications</CardTitle>
            <Link to="/contractors">
              <Button variant="ghost" size="sm" className="text-xs">Manage</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {contractors === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {contractors !== null && pendingContractors.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle size={16} /> No pending applications
              </div>
            )}
            {pendingContractors.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{c.trading_name ?? c.legal_name ?? 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">{c.primary_trade ?? '—'} · {c.base_postcode ?? '—'}</p>
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming jobs calendar view */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={16} /> Upcoming jobs
            </CardTitle>
            <Link to="/jobs">
              <Button variant="ghost" size="sm" className="text-xs">All jobs</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {jobs !== null && upcomingJobs.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming jobs scheduled.</p>
            )}
            <div className="divide-y">
              {upcomingJobs.map((j) => (
                <div key={j.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-[64px] text-center rounded-lg border px-2 py-1">
                    <p className="text-xs text-muted-foreground">{j.start_date ? new Date(j.start_date).toLocaleDateString('en-GB', { month: 'short' }) : '—'}</p>
                    <p className="text-lg font-bold leading-none">{j.start_date ? new Date(j.start_date).getDate() : '—'}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/jobs/${j.id}`} className="font-medium text-sm hover:underline text-primary truncate block">
                      {j.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{j.trade_category ?? '—'} · {j.site_postcode ?? '—'}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusClass(j.status)}`}>
                    {j.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly calendar view */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={16} /> Job calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {jobs !== null && <AdminJobCalendar jobs={jobs} />}
          </CardContent>
        </Card>

        {/* Schedule / Gantt timeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GanttChart size={16} /> Schedule timeline
            </CardTitle>
            <Link to="/jobs">
              <Button variant="ghost" size="sm" className="text-xs">Manage jobs</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {jobs !== null && <JobGantt jobs={jobs} />}
          </CardContent>
        </Card>

        {/* Credentials awaiting review */}
        {credentials !== null && credentials.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Credentials awaiting review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {credentials.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{c.registration_or_policy_number ?? c.credential_type_id}</p>
                      <p className="text-xs text-muted-foreground">Expires: {c.expiry_date ?? 'N/A'} · Issuer: {c.issuer ?? '—'}</p>
                    </div>
                    <Link to="/compliance">
                      <Button size="sm" variant="outline">Review</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, loading }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className={`mb-1 ${color}`}>{icon}</div>
        <p className="text-2xl font-bold">{loading ? '…' : value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}