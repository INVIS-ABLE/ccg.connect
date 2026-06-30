import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/app/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, FileText, CheckCircle } from 'lucide-react';
import { ProfileCompleteness } from '@/app/components/ProfileCompleteness';

const URGENCY_COLOR = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
};

export default function ContractorDashboard() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [timesheets, setTimesheets] = useState(null);
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    api.jobs.list().then((r) => setJobs(r.jobs)).catch(() => setJobs([]));
    api.timesheets.list().then((r) => setTimesheets(r.timesheets)).catch(() => setTimesheets([]));
    api.credentials.list().then((r) => setCredentials(r.credentials)).catch(() => setCredentials([]));
  }, []);

  const name = profile?.display_name || profile?.first_name || 'Contractor';
  const upcomingJobs = jobs
    ?.filter((j) => ['confirmed', 'in_progress', 'enquiry'].includes(j.status))
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date) - new Date(b.start_date);
    })
    .slice(0, 5) ?? [];

  const recentTimesheets = timesheets?.slice(0, 3) ?? [];
  const expiringCredentials = credentials?.filter((c) => {
    if (!c.expiry_date) return false;
    const days = (new Date(c.expiry_date) - new Date()) / 86400000;
    return days <= 30;
  }) ?? [];

  return (
    <div className="space-y-6">
      <ProfileCompleteness />
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {name}</h1>
        <p className="text-sm text-muted-foreground">Here's your work overview for today</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{jobs === null ? '…' : upcomingJobs.length}</p>
            <p className="text-xs text-muted-foreground">Active jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{timesheets === null ? '…' : (timesheets.filter(t => t.status === 'submitted').length)}</p>
            <p className="text-xs text-muted-foreground">Timesheets pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-red-500">{credentials === null ? '…' : expiringCredentials.length}</p>
            <p className="text-xs text-muted-foreground">Creds expiring</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring credentials warning */}
      {expiringCredentials.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠ Credentials expiring soon</p>
            {expiringCredentials.map((c) => (
              <p key={c.id} className="text-xs text-amber-600 dark:text-amber-300">
                {c.registration_or_policy_number ?? c.credential_type_id} — expires {c.expiry_date}
              </p>
            ))}
            <Link to="/contractor/credentials">
              <Button size="sm" variant="outline" className="mt-2 text-xs">Manage credentials</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Upcoming jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays size={16} /> Upcoming jobs
          </CardTitle>
          <Link to="/contractor/jobs">
            <Button variant="ghost" size="sm" className="text-xs">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {jobs !== null && upcomingJobs.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle size={16} className="text-green-500" /> No upcoming jobs right now
            </div>
          )}
          <div className="divide-y">
            {upcomingJobs.map((j) => (
              <div key={j.id} className="flex items-start gap-3 py-3">
                <div className="min-w-[48px] text-center rounded-md border px-1 py-1">
                  <p className="text-xs text-muted-foreground leading-none">
                    {j.start_date ? new Date(j.start_date).toLocaleDateString('en-GB', { month: 'short' }) : '—'}
                  </p>
                  <p className="text-lg font-bold leading-none">
                    {j.start_date ? new Date(j.start_date).getDate() : '—'}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{j.title}</p>
                  <p className="text-xs text-muted-foreground">{j.site_postcode ?? '—'} · {j.trade_category ?? '—'}</p>
                  {j.client_visible_notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{j.client_visible_notes}</p>
                  )}
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${URGENCY_COLOR[j.urgency] ?? 'bg-gray-100 text-gray-600'}`}>
                  {j.urgency}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent timesheets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock size={16} /> Recent timesheets
          </CardTitle>
          <Link to="/contractor/timesheets">
            <Button variant="ghost" size="sm" className="text-xs">Submit / view</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {timesheets === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {timesheets !== null && recentTimesheets.length === 0 && (
            <p className="text-sm text-muted-foreground">No timesheets submitted yet.</p>
          )}
          <div className="divide-y">
            {recentTimesheets.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Week of {t.week_start}</p>
                  <p className="text-xs text-muted-foreground">{t.total_hours ?? '—'} hrs · £{t.total_amount ?? '—'}</p>
                </div>
                <Badge variant={t.status === 'approved' ? 'default' : t.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} /> Recent document updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Documents from your active jobs will appear here.</p>
          <Link to="/contractor/credentials">
            <Button variant="outline" size="sm" className="mt-3">View credentials</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}