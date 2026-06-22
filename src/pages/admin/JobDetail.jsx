import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { JOB_STATUSES } from '@/lib/roles';
import { toast } from 'sonner';
import JobNotesSection from '@/components/jobs/JobNotesSection';
import VoiceToolbar from '@/components/voice/VoiceToolbar';

// Ordered workflow pipeline shown visually
const PIPELINE = [
  { key: 'draft',           label: 'Draft' },
  { key: 'ready_to_match',  label: 'Ready to Match' },
  { key: 'offers_sent',     label: 'Offered' },
  { key: 'assigned',        label: 'Accepted' },
  { key: 'in_progress',     label: 'In Progress' },
  { key: 'snagging',        label: 'Snagging' },
  { key: 'completed',       label: 'Completed' },
];

// All statuses available for manual override
const ALL_STATUSES = Object.entries(JOB_STATUSES).map(([key, val]) => ({ key, label: val.label }));

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    base44.entities.Job.filter({ id }).then(([j]) => {
      setJob(j || null);
      setLoading(false);
    });
  }, [id]);

  const advanceStatus = async (newStatus) => {
    const prevStatus = job.status;
    // Optimistic update — apply immediately
    setJob(j => ({ ...j, status: newStatus }));
    toast.success(`Status updated to "${JOB_STATUSES[newStatus]?.label}"`);
    setUpdating(true);
    try {
      await base44.entities.Job.update(job.id, { status: newStatus });
    } catch {
      // Roll back on failure
      setJob(j => ({ ...j, status: prevStatus }));
      toast.error('Failed to update status');
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Job not found.</p>
        <Link to="/jobs"><Button variant="outline" size="sm" className="mt-3">Back to Jobs</Button></Link>
      </div>
    );
  }

  const currentStep = PIPELINE.findIndex(p => p.key === job.status);
  const nextStep = currentStep !== -1 && currentStep < PIPELINE.length - 1 ? PIPELINE[currentStep + 1] : null;
  const s = JOB_STATUSES[job.status];

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Jobs
        </Link>
      </div>

      <PageHeader
        title={job.title}
        subtitle={`${job.job_reference || 'No ref'} • ${job.site_postcode || 'No postcode'}`}
        actions={s && <StatusBadge label={s.label} color={s.color} />}
      />

      {/* Status Pipeline */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Workflow Status</h2>

        {/* Visual pipeline */}
        <div className="flex items-center gap-0 overflow-x-auto pb-2 mb-5">
          {PIPELINE.map((step, i) => {
            const isDone = currentStep !== -1 && i < currentStep;
            const isCurrent = i === currentStep;
            const isAhead = currentStep === -1 || i > currentStep;
            return (
              <div key={step.key} className="flex items-center flex-shrink-0">
                <div
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                  onClick={() => !updating && advanceStatus(step.key)}
                  title={`Set to "${step.label}"`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all
                    ${isDone ? 'bg-primary border-primary' : isCurrent ? 'border-primary bg-primary/10' : 'border-border bg-muted group-hover:border-primary/50'}`}>
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : isCurrent ? (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <span className={`text-xs text-center max-w-[64px] leading-tight
                    ${isCurrent ? 'text-primary font-semibold' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className={`h-0.5 w-8 flex-shrink-0 mx-1 mb-5 ${isDone || isCurrent ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Quick-advance button */}
        <div className="flex items-center gap-3 flex-wrap">
          {nextStep && (
            <Button
              onClick={() => advanceStatus(nextStep.key)}
              disabled={updating}
              className="bg-[#F97316] hover:bg-[#ea6a0a] text-white gap-2"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Advance to "{nextStep.label}"
            </Button>
          )}
          {job.status === 'completed' && (
            <div className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Job Complete
            </div>
          )}
          {/* Manual override */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Override:</span>
            <Select value={job.status} onValueChange={advanceStatus} disabled={updating}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map(({ key, label }) => (
                  <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Job Details */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Job Information</h2>
          <Field label="Client ID" value={job.client_id} />
          <Field label="Trade" value={job.trade_category} />
          <Field label="Urgency" value={job.urgency} />
          <Field label="Start Date" value={job.start_date} />
          <Field label="End Date" value={job.end_date} />
          <Field label="Budget" value={job.budget ? `£${job.budget.toLocaleString()}` : undefined} />
          <Field label="Headcount" value={job.headcount_required} />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Site Details</h2>
          <Field label="Address" value={job.site_address} />
          <Field label="Postcode" value={job.site_postcode} />
          <Field label="Access" value={job.access_instructions} />
          <Field label="Parking" value={job.parking_instructions} />
          <Field label="H&S Notes" value={job.health_and_safety_notes} />
          {job.internal_notes && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Internal Notes</span>
              <p className="text-sm bg-muted/50 rounded p-2">{job.internal_notes}</p>
            </div>
          )}
        </div>
      </div>

      {job.short_description && (
        <div className="bg-card border border-border rounded-xl p-4 mt-4">
          <h2 className="text-sm font-semibold mb-2">Description</h2>
          <p className="text-sm text-muted-foreground">{job.short_description}</p>
        </div>
      )}

      {/* Notes section */}
      <div className="mt-4">
        <JobNotesSection
          jobId={job.id}
          existingNotes={job.internal_notes}
          userRole="admin"
          onSaved={(notes) => setJob(j => ({ ...j, internal_notes: notes }))}
        />
      </div>

      {/* Voice toolbar */}
      <VoiceToolbar />
    </div>
  );
}

function Field({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{String(value)}</p>
    </div>
  );
}