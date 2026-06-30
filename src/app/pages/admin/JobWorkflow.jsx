import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaGallery } from '@/app/MediaGallery';
import { QuoteBuilder } from '@/app/components/QuoteBuilder';
import { SavedQuotes } from '@/app/components/SavedQuotes';
import { JobCheckinPanel } from '@/app/components/JobCheckinPanel';
import { JobContactsPanel } from '@/app/components/JobContactsPanel';
import { ArrowLeft, MapPin, Calendar, ChevronRight, CheckCircle } from 'lucide-react';

const STAGES = [
  { key: 'enquiry', label: 'Enquiry received' },
  { key: 'quoted', label: 'Quote sent' },
  { key: 'viewing', label: 'Viewing / site visit' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'support', label: 'Support / check-in' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function StageTracker({ current }) {
  const active = STAGES.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STAGES.filter(s => s.key !== 'cancelled').map((s, i) => {
        const done = i < active;
        const isCurrent = s.key === current;
        return (
          <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isCurrent ? 'bg-primary text-primary-foreground' : done ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
              {done && <CheckCircle size={10} />}
              {s.label}
            </div>
            {i < STAGES.filter(s => s.key !== 'cancelled').length - 1 && (
              <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function JobWorkflow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [quotesRefresh, setQuotesRefresh] = useState(0);
  const [sigMsg, setSigMsg] = useState(null);

  useEffect(() => {
    api.jobs.get(id).then((r) => setJob(r.job)).catch(() => setError('Could not load job.'));
  }, [id]);

  async function updateStatus(status) {
    setSaving(true);
    try {
      const r = await api.jobs.update(id, { status });
      setJob(r.job);
    } catch {
      setError('Could not update status.');
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const r = await api.jobs.update(id, { internal_notes: (job.internal_notes ? job.internal_notes + '\n\n' : '') + `[${new Date().toLocaleDateString('en-GB')}] ${note}` });
      setJob(r.job);
      setNote('');
    } catch {
      setError('Could not save note.');
    } finally {
      setSaving(false);
    }
  }

  function jobDocProps() {
    return {
      reference: job.job_reference ?? job.id.slice(0, 8).toUpperCase(),
      title: job.title,
      site: [job.site_address, job.site_postcode].filter(Boolean).join(' · '),
      dates: job.start_date
        ? `${new Date(job.start_date).toLocaleDateString('en-GB')}${job.end_date ? ` – ${new Date(job.end_date).toLocaleDateString('en-GB')}` : ''}`
        : '',
      trade: job.trade_category ?? '',
      urgency: job.urgency ?? '',
      status: job.status ?? '',
      description: job.short_description ?? '',
      clientNotes: job.client_visible_notes ?? '',
    };
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadJobSheet() {
    const mod = await import('@/features/documents/jobDocuments');
    const blob = await mod.generateJobSheetBlob({ job: jobDocProps(), logoUrl: `${window.location.origin}/ccg-logo.png` });
    triggerDownload(blob, `job-sheet-${jobDocProps().reference}.pdf`);
  }

  async function downloadCompletion() {
    const mod = await import('@/features/documents/jobDocuments');
    const blob = await mod.generateCompletionBlob({
      job: jobDocProps(),
      completedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      logoUrl: `${window.location.origin}/ccg-logo.png`,
    });
    triggerDownload(blob, `completion-${jobDocProps().reference}.pdf`);
  }

  async function requestSignature() {
    setSigMsg('Requesting…');
    try {
      const r = await api.signatures.request(id);
      setSigMsg(
        r.configured
          ? 'Signature request sent to the client.'
          : 'E-signatures are not enabled yet (add DOCUMENSO_API_KEY).',
      );
    } catch {
      setSigMsg('Could not request a signature — check the job has a client with an email.');
    }
  }

  if (error && !job) return <p className="text-sm text-destructive">{error}</p>;
  if (!job) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const nextStages = STAGES.filter(
    (s) => s.key !== job.status && s.key !== 'cancelled'
  ).slice(0, 3);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/jobs')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{job.title}</h1>
          <p className="text-xs text-muted-foreground">{job.job_reference ?? job.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <Badge variant="secondary">{job.status}</Badge>
      </div>

      {/* Stage tracker */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <StageTracker current={job.status} />
        </CardContent>
      </Card>

      {/* Job info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Site details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {job.site_address && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 text-muted-foreground flex-shrink-0" />
                <span>{job.site_address}</span>
              </div>
            )}
            {job.site_postcode && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={14} className="flex-shrink-0" />
                <span>{job.site_postcode}</span>
              </div>
            )}
            {job.start_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar size={14} className="flex-shrink-0" />
                <span>{new Date(job.start_date).toLocaleDateString('en-GB')}
                  {job.end_date ? ` – ${new Date(job.end_date).toLocaleDateString('en-GB')}` : ''}
                </span>
              </div>
            )}
            <div className="pt-2">
              <Badge variant="outline">{job.trade_category ?? '—'}</Badge>
              {' '}
              <Badge variant={job.urgency === 'emergency' ? 'destructive' : 'outline'}>{job.urgency}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Advance stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nextStages.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant="outline"
                className="w-full justify-start"
                disabled={saving}
                onClick={() => updateStatus(s.key)}
              >
                → {s.label}
              </Button>
            ))}
            {job.status !== 'cancelled' && (
              <Button size="sm" variant="ghost" className="w-full text-red-500 hover:text-red-600" disabled={saving} onClick={() => updateStatus('cancelled')}>
                Cancel job
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contact / arrange</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <JobContactsPanel job={job} />
          <div className="space-y-2 pt-2">
            <Label className="text-xs">Quick message template</Label>
            <Select onValueChange={(v) => setContactMsg(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="We have received your enquiry and will be in touch within 24 hours to arrange a site visit.">Enquiry acknowledgement</SelectItem>
                <SelectItem value="We'd like to arrange a site visit for your project. Please confirm a convenient date and time.">Request site visit</SelectItem>
                <SelectItem value="Your quote for the requested work is ready. Please see the attached document for details.">Quote ready</SelectItem>
                <SelectItem value="Work on your project is now confirmed and your contractor will be in touch to confirm start arrangements.">Confirm job</SelectItem>
                <SelectItem value="We're checking in on your project — please let us know if you have any questions or concerns.">Check-in</SelectItem>
                <SelectItem value="Your project has been completed. Please don't hesitate to get in touch if you have any feedback.">Completion</SelectItem>
              </SelectContent>
            </Select>
            {contactMsg && (
              <Textarea value={contactMsg} onChange={(e) => setContactMsg(e.target.value)} rows={3} className="text-sm" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match link */}
      <Card>
        <CardContent className="pt-4 pb-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Contractor matching</p>
            <p className="text-xs text-muted-foreground">Find and assign the best contractor for this job</p>
          </div>
          <Link to={`/jobs/${id}/match`}>
            <Button size="sm">Run match</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Site evidence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Site evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaGallery jobId={id} canUpload />
        </CardContent>
      </Card>

      {/* On-site check-in (QR) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Site check-in</CardTitle>
        </CardHeader>
        <CardContent>
          <JobCheckinPanel jobId={id} />
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={downloadJobSheet}>
            Download job sheet
          </Button>
          <Button size="sm" variant="outline" onClick={downloadCompletion}>
            Download completion record
          </Button>
          <Button size="sm" variant="outline" onClick={requestSignature}>
            Request client e-signature
          </Button>
          {sigMsg && <p className="w-full text-xs text-muted-foreground">{sigMsg}</p>}
        </CardContent>
      </Card>

      {/* Quote builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quote</CardTitle>
        </CardHeader>
        <CardContent>
          <QuoteBuilder job={job} onSaved={() => setQuotesRefresh((n) => n + 1)} />
          <SavedQuotes job={job} refresh={quotesRefresh} />
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Internal notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {job.internal_notes && (
            <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {job.internal_notes}
            </pre>
          )}
          <Textarea
            placeholder="Add a note…"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button size="sm" disabled={saving || !note.trim()} onClick={saveNote}>
            Save note
          </Button>
        </CardContent>
      </Card>

      {/* Client visible notes */}
      {job.client_visible_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Client-visible notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{job.client_visible_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}