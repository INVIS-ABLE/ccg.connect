import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, MapPin, Calendar, Clock, Loader2 } from 'lucide-react';
import { JOB_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';
import JobNotesSection from '@/components/jobs/JobNotesSection';
import VoiceToolbar from '@/components/voice/VoiceToolbar';

export default function ContractorJobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Job.filter({ id }),
      base44.entities.JobAssignment.filter({ job_id: id }),
    ]).then(([jobs, assigns]) => {
      setJob(jobs[0] || null);
      setAssignment(assigns[0] || null);
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!job) return (
    <div className="p-4 text-center text-sm text-muted-foreground">
      <p>Job not found.</p>
      <Link to="/contractor/jobs" className="text-primary underline text-xs mt-2 inline-block">Back to jobs</Link>
    </div>
  );

  const s = JOB_STATUSES[job.status];

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      <Link to="/contractor/jobs" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4 hover:text-foreground">
        <ChevronLeft className="w-3.5 h-3.5" /> Back to Jobs
      </Link>

      <div className="flex items-start justify-between mb-4">
        <h1 className="text-lg font-bold">{job.title}</h1>
        {s && <StatusBadge label={s.label} color={s.color} />}
      </div>

      {/* Info card */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 mb-4">
        {job.site_address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>{job.site_address}{job.site_postcode ? `, ${job.site_postcode}` : ''}</span>
          </div>
        )}
        {(job.start_date || job.end_date) && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span>{job.start_date || '?'} → {job.end_date || 'TBC'}</span>
          </div>
        )}
        {assignment && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span>Rate: {assignment.agreed_rate_type} • £{assignment.agreed_rate || 'TBC'}</span>
          </div>
        )}
      </div>

      {/* Site instructions */}
      {(job.access_instructions || job.parking_instructions || job.health_and_safety_notes) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 mb-4">
          <h2 className="text-sm font-semibold">Site Information</h2>
          {job.access_instructions && (
            <div>
              <span className="text-xs text-muted-foreground">Access</span>
              <p className="text-sm">{job.access_instructions}</p>
            </div>
          )}
          {job.parking_instructions && (
            <div>
              <span className="text-xs text-muted-foreground">Parking</span>
              <p className="text-sm">{job.parking_instructions}</p>
            </div>
          )}
          {job.health_and_safety_notes && (
            <div>
              <span className="text-xs text-muted-foreground">H&S Notes</span>
              <p className="text-sm">{job.health_and_safety_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Scope */}
      {job.full_scope && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2">Scope of Work</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.full_scope}</p>
        </div>
      )}

      {/* Notes — contractor visible */}
      {job.client_visible_notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-1">Notes from CCG</h2>
          <p className="text-sm text-amber-700">{job.client_visible_notes}</p>
        </div>
      )}

      {/* Notes upload by contractor */}
      <JobNotesSection
        jobId={job.id}
        existingNotes={job.client_visible_notes}
        userRole="contractor"
        onSaved={(notes) => setJob(j => ({ ...j, client_visible_notes: notes }))}
      />

      {/* Voice toolbar */}
      <VoiceToolbar />
    </div>
  );
}