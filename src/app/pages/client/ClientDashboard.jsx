import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/app/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, CalendarDays, Briefcase, FileText, ImageIcon, CheckCircle, Clock } from 'lucide-react';
import { ProfileCompleteness } from '@/app/components/ProfileCompleteness';

const STATUS_LABEL = {
  draft: 'Draft', enquiry: 'Enquiry received', quoted: 'Quote sent',
  confirmed: 'Confirmed', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_BADGE = {
  draft: 'secondary', enquiry: 'secondary', quoted: 'outline',
  confirmed: 'default', in_progress: 'default', completed: 'default', cancelled: 'destructive',
};

const PIPELINE = ['enquiry', 'quoted', 'confirmed', 'in_progress', 'completed'];

function StatusPipeline({ status }) {
  const idx = PIPELINE.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
      {PIPELINE.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
              ${current ? 'bg-primary text-primary-foreground' : done ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
              {done && <CheckCircle size={9} />}
              {STATUS_LABEL[s] ?? s}
            </div>
            {i < PIPELINE.length - 1 && <span className="text-muted-foreground text-xs">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function JobMediaPanel({ job }) {
  const [media, setMedia] = useState(null);
  const [approving, setApproving] = useState(null);

  useEffect(() => {
    api.media.list(job.id).then((r) => setMedia(r.media)).catch(() => setMedia([]));
  }, [job.id]);

  const photos = (media ?? []).filter((m) => m.media_type === 'image' && m.client_visible);
  const docs   = (media ?? []).filter((m) => m.media_type === 'document' && m.client_visible);

  if (!media) return <p className="text-xs text-muted-foreground">Loading documents…</p>;
  if (!photos.length && !docs.length) return <p className="text-xs text-muted-foreground">No shared files yet.</p>;

  return (
    <div className="space-y-3">
      {docs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Documents</p>
          <div className="space-y-1">
            {docs.map((d) => (
              <a
                key={d.id}
                href={api.media.fileUrl(d.id)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="truncate">{d.original_filename ?? d.caption ?? 'Document'}</span>
                <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">View →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Completion photos — please approve</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden border">
                <img
                  src={api.media.fileUrl(p.id)}
                  alt={p.caption ?? 'Photo'}
                  className="w-full h-24 object-cover"
                />
                {p.caption && (
                  <p className="text-[10px] text-muted-foreground px-1 pt-1 truncate">{p.caption}</p>
                )}
                <Button
                  size="sm"
                  className="w-full rounded-t-none text-xs h-7"
                  disabled={approving === p.id}
                  onClick={async () => {
                    setApproving(p.id);
                    // In a real integration this would call an approval endpoint
                    setTimeout(() => setApproving(null), 800);
                  }}
                >
                  {approving === p.id ? <Clock size={12} /> : <><CheckCircle size={12} /> Approve</>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientDashboard() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);

  useEffect(() => {
    api.jobs.list().then((r) => setJobs(r.jobs)).catch(() => setJobs([]));
  }, []);

  const name = profile?.display_name || profile?.first_name || 'there';
  const activeJobs = jobs?.filter((j) => !['completed', 'cancelled'].includes(j.status)) ?? [];
  const completedJobs = jobs?.filter((j) => j.status === 'completed') ?? [];

  return (
    <div className="space-y-6">
      <ProfileCompleteness />
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
                {/* Status pipeline */}
                <StatusPipeline status={j.status} />

                {j.client_visible_notes && (
                  <p className="mt-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                    💬 {j.client_visible_notes}
                  </p>
                )}

                {/* Shared docs & photos toggle */}
                <button
                  className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => setExpandedJob(expandedJob === j.id ? null : j.id)}
                >
                  <ImageIcon size={12} />
                  {expandedJob === j.id ? 'Hide documents & photos' : 'View documents & photos'}
                </button>
                {expandedJob === j.id && (
                  <div className="mt-3 pl-1">
                    <JobMediaPanel job={j} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming dates */}
      {activeJobs.filter((j) => j.start_date).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={16} /> Upcoming dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {activeJobs
                .filter((j) => j.start_date)
                .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                .map((j) => (
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

      {/* Completed projects with docs */}
      {completedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completed projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {completedJobs.map((j) => (
                <div key={j.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{j.title}</p>
                    <Badge variant="default">Completed</Badge>
                  </div>
                  <button
                    className="mt-1 text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => setExpandedJob(expandedJob === j.id ? null : j.id)}
                  >
                    <FileText size={11} />
                    {expandedJob === j.id ? 'Hide files' : 'View documents & photos'}
                  </button>
                  {expandedJob === j.id && (
                    <div className="mt-3 pl-1">
                      <JobMediaPanel job={j} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}