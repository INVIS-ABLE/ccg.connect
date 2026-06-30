import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTriangle, Send, CheckCircle2 } from 'lucide-react';
import { KID_LEGAL_NOTICE, missingKidFields } from '@/domain/commercial/kid';

const TEXT_FIELDS = [
  ['employment_business', 'Employment business'],
  ['contract_type', 'Type of contract'],
  ['paid_by', 'Who pays you'],
  ['pay_frequency', 'How often you are paid'],
];
const AREA_FIELDS = [
  ['deductions', 'Deductions (statutory & other)'],
  ['holiday_entitlement', 'Holiday entitlement'],
  ['holiday_pay', 'Holiday pay'],
  ['other_fees', 'Other fees / benefits'],
  ['example_calculation', 'Example pay calculation'],
  ['notes', 'Notes'],
];

const STATUS_VARIANT = { draft: 'secondary', issued: 'default', acknowledged: 'default', superseded: 'outline' };

/**
 * Author / issue / acknowledge a Key Information Document. The wording is a draft
 * pending employment-law sign-off (banner shown prominently) and nothing here
 * determines tax/employment status — it records facts for that review.
 */
export function KidEditorDialog({ kid, workerName, open, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kid) {
      setForm({
        employment_business: kid.employment_business ?? '', contract_type: kid.contract_type ?? '',
        paid_by: kid.paid_by ?? '', pay_frequency: kid.pay_frequency ?? '', pay_rate: kid.pay_rate ?? '',
        deductions: kid.deductions ?? '', holiday_entitlement: kid.holiday_entitlement ?? '',
        holiday_pay: kid.holiday_pay ?? '', other_fees: kid.other_fees ?? '',
        example_calculation: kid.example_calculation ?? '', notes: kid.notes ?? '',
      });
      setSignature('');
    }
  }, [kid]);

  if (!kid || !form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const missing = missingKidFields({ ...form, pay_rate: form.pay_rate === '' ? null : Number(form.pay_rate) });

  async function save(extra = {}) {
    setBusy(true);
    try {
      await api.kids.update(kid.id, { ...form, pay_rate: form.pay_rate === '' ? null : Number(form.pay_rate), ...extra });
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge() {
    if (!signature.trim()) return;
    setBusy(true);
    try {
      await api.kids.acknowledge(kid.id, signature.trim());
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Key Information Document
            <Badge variant={STATUS_VARIANT[kid.status]} className="capitalize">{kid.status}</Badge>
            <span className="text-xs text-muted-foreground">v{kid.version}</span>
          </DialogTitle>
          <DialogDescription>For {workerName ?? 'worker'}.</DialogDescription>
        </DialogHeader>

        {/* Legal guardrail — always visible. */}
        <p className="flex items-start gap-2 rounded-md bg-amber-100 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {KID_LEGAL_NOTICE}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input value={form[k]} onChange={set(k)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-xs">Pay rate (£/hour)</Label>
            <Input type="number" step="any" value={form.pay_rate} onChange={set('pay_rate')} />
          </div>
        </div>
        <div className="space-y-3">
          {AREA_FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Textarea rows={2} value={form[k]} onChange={set(k)} />
            </div>
          ))}
        </div>

        {missing.length > 0 && (
          <p className="text-xs text-amber-600">
            {missing.length} expected field{missing.length === 1 ? '' : 's'} still blank — complete before issuing.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} disabled={busy} variant="outline">{busy ? 'Saving…' : 'Save draft'}</Button>
          {kid.status === 'draft' && (
            <Button onClick={() => save({ status: 'issued' })} disabled={busy || missing.length > 0} className="gap-1.5">
              <Send size={14} /> Issue to worker
            </Button>
          )}
        </div>

        {/* Acknowledgement */}
        {kid.status === 'acknowledged' ? (
          <p className="flex items-center gap-1.5 rounded-md bg-green-100 p-2.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">
            <CheckCircle2 size={14} /> Acknowledged by {kid.acknowledged_signature} on{' '}
            {kid.acknowledged_at ? new Date(kid.acknowledged_at).toLocaleString('en-GB') : ''}
          </p>
        ) : kid.status === 'issued' ? (
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-xs">Record acknowledgement (worker's name as signature)</Label>
            <div className="flex gap-2">
              <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={workerName ?? 'Full name'} />
              <Button onClick={acknowledge} disabled={busy || !signature.trim()}>Acknowledge</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">The worker can also acknowledge from their own login.</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
