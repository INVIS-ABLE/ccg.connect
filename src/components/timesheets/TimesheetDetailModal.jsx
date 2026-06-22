import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckCircle, XCircle, Clock, User, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TIMESHEET_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';

export default function TimesheetDetailModal({ timesheetId, onClose, onUpdated }) {
  const [timesheet, setTimesheet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [job, setJob] = useState(null);
  const [contractor, setContractor] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Timesheet.filter({ id: timesheetId }),
      base44.entities.TimesheetEntry.filter({ timesheet_id: timesheetId }),
    ]).then(async ([ts, en]) => {
      const t = ts[0];
      setTimesheet(t);
      setEntries(en.sort((a, b) => a.work_date?.localeCompare(b.work_date)));
      if (t?.job_id) {
        const jobs = await base44.entities.Job.filter({ id: t.job_id });
        setJob(jobs[0] || null);
      }
      if (t?.contractor_id) {
        const cp = await base44.entities.ContractorProfile.filter({ id: t.contractor_id });
        setContractor(cp[0] || null);
      }
      setLoading(false);
    });
  }, [timesheetId]);

  const handleApprove = async () => {
    setSaving(true);
    await base44.entities.Timesheet.update(timesheetId, {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    });
    toast.success('Timesheet approved');
    onUpdated?.();
    onClose();
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast.error('Please provide a reason'); return; }
    setSaving(true);
    await base44.entities.Timesheet.update(timesheetId, {
      status: 'needs_correction',
      rejection_reason: rejectionReason,
    });
    toast.success('Returned for correction');
    onUpdated?.();
    onClose();
  };

  const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-card rounded-xl p-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
    </div>
  );

  if (!timesheet) return null;

  const s = TIMESHEET_STATUSES[timesheet.status];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-base">Timesheet Review</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Week of {timesheet.week_start}</p>
          </div>
          <div className="flex items-center gap-2">
            {s && <StatusBadge label={s.label} color={s.color} />}
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-5 py-3 border-b border-border flex gap-4 flex-wrap text-sm flex-shrink-0">
          {job && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{job.title}</span>
            </div>
          )}
          {contractor && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>{contractor.trading_name || contractor.legal_name || 'Contractor'}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-semibold text-foreground">{totalHours.toFixed(1)}h total</span>
            {timesheet.total_amount && <span>• £{timesheet.total_amount.toFixed(2)}</span>}
          </div>
        </div>

        {/* Entries */}
        <div className="overflow-y-auto flex-1 p-5">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No entries logged</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Start</th>
                  <th className="text-left pb-2 font-medium">Finish</th>
                  <th className="text-left pb-2 font-medium">Break</th>
                  <th className="text-right pb-2 font-medium">Hours</th>
                  <th className="text-right pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="py-2.5 font-medium">{e.work_date}</td>
                    <td className="py-2.5 text-muted-foreground">{e.start_time || '—'}</td>
                    <td className="py-2.5 text-muted-foreground">{e.finish_time || '—'}</td>
                    <td className="py-2.5 text-muted-foreground">{e.break_minutes ? `${e.break_minutes}m` : '—'}</td>
                    <td className="py-2.5 text-right font-medium">{e.total_hours?.toFixed(1) || '—'}</td>
                    <td className="py-2.5 text-right">{e.rate && e.total_hours ? `£${(e.rate * e.total_hours).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td colSpan={4} className="pt-2.5 text-sm">Total</td>
                  <td className="pt-2.5 text-right text-sm">{totalHours.toFixed(1)}h</td>
                  <td className="pt-2.5 text-right text-sm">{timesheet.total_amount ? `£${timesheet.total_amount.toFixed(2)}` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {timesheet.rejection_reason && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Previous note:</strong> {timesheet.rejection_reason}
            </div>
          )}

          {showRejectForm && (
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">Reason for returning</label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain what needs to be corrected..."
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        {timesheet.status === 'submitted' && (
          <div className="p-4 border-t border-border flex gap-2 flex-shrink-0">
            {!showRejectForm ? (
              <>
                <Button onClick={handleApprove} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
                <Button onClick={() => setShowRejectForm(true)} variant="outline" className="flex-1 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50">
                  <XCircle className="w-4 h-4" /> Return for Correction
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleReject} disabled={saving || !rejectionReason.trim()} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                  Send Back
                </Button>
                <Button onClick={() => setShowRejectForm(false)} variant="outline">Cancel</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}