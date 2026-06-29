import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/app/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, CalendarDays, Briefcase } from 'lucide-react';

const STATUS_LABEL = {
  draft: 'Draft',
  enquiry: 'Enquiry received',
  quoted: 'Quote sent',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE = {
  draft: 'secondary',
  enquiry: 'secondary',
  quoted: 'outline',
  confirmed: 'default',
  in_progress: 'default',
  completed: 'default',
  cancelled: 'destructive',
};

export default function ClientDashboard() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState(null);

  useEffect(() => {
    api.jobs.list().then((r) => setJobs(r.jobs)).catch(() => setJobs([]));
  }, []);

  const name = profile?.display_name || profile?.first_name || 'there';
  const activeJobs = jobs?.filter((j) => !['completed', 'cancelled'].includes(j.status)) ?? [];
  const completedJobs = jobs?.filter((j) => j.status === 'completed') ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hello, {name}</h1>
          <p className="text-sm text-muted-foreground">Your projects with Cook Construction Growth</p>
        </div>
        <Link to="/client/submit-job">
          <Button className="flex items-center gap-2">
            <Plus size={16} /> Submit a job
          </Button>
        </Link>
      </div>

      {/* Active projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase size={16} /> Active projects
          </CardTitle>
          <Link to="/client/projects">
            <Button variant="ghost" size="sm" className="text-xs">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {jobs !== null && activeJobs.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">No active projects yet.</p>
              <Link to="/client/submit-job">
                <Button size="sm">Submit your first job</Button>
              </Link>
            </div>
          )}
          <div className="divide-y">
            {activeJobs.map((j) => (
              <div key={j.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{j.title}</p>
                  <Badge variant={STATUS_BADGE[j.status] ?? 'secondary'}>
                    {STATUS_LABEL[j.status] ?? j.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {j.trade_category ?? '—'}
                  {j.site_postcode ? ` · ${j.site_postcode}` : ''}
                  {j.start_date ? ` · Starts ${new Date(j.start_date).toLocaleDateString('en-GB')}` : ''}
                </p>
                {j.client_visible_notes && (
                  <p className="mt-1 text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                    {j.client_visible_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming dates */}
      {activeJobs.filter(j => j.start_date).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={16} /> Upcoming dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {activeJobs.filter(j => j.start_date).sort((a,b) => new Date(a.start_date) - new Date(b.start_date)).map((j) => (
                <div key={j.id} className="flex items-center gap-4 py-2">
                  <div className="text-center min-w-[48px] border rounded px-1 py-1">
                    <p className="text-xs text-muted-foreground leading-none">
                      {new Date(j.start_date).toLocaleDateString('en-GB', { month: 'short' })}
                    </p>
                    <p className="font-bold text-lg leading-none">{new Date(j.start_date).getDate()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{j.title}</p>
                    <p className="text-xs text-muted-foreground">{j.site_postcode ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed jobs */}
      {completedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completed projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {completedJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-2">
                  <p className="text-sm font-medium">{j.title}</p>
                  <Badge variant="default">Completed</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}