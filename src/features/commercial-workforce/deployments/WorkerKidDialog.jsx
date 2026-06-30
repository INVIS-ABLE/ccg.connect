import { useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';

const ROWS = [
  ['employment_business', 'Employment business'],
  ['contract_type', 'Type of contract'],
  ['paid_by', 'Who pays you'],
  ['pay_rate', 'Pay rate (£/hour)'],
  ['pay_frequency', 'How often you are paid'],
  ['deductions', 'Deductions'],
  ['holiday_entitlement', 'Holiday entitlement'],
  ['holiday_pay', 'Holiday pay'],
  ['other_fees', 'Other fees / benefits'],
  ['example_calculation', 'Example pay calculation'],
];

/**
 * Worker-facing review + acknowledgement of their Key Information Document. The
 * worker reads the terms and confirms by typing their name (e-signature) — calls
 * the same acknowledge endpoint ops use on their behalf.
 */
export function WorkerKidDialog({ kid, open, onClose, onAcknowledged }) {
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  if (!kid) return null;

  async function acknowledge() {
    if (!signature.trim()) return;
    setBusy(true);
    try {
      await api.kids.acknowledge(kid.id, signature.trim());
      onAcknowledged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const rows = ROWS.filter(([k]) => kid[k] != null && kid[k] !== '');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Key Information Document</DialogTitle>
          <DialogDescription>Please read this summary of your assignment terms, then confirm below.</DialogDescription>
        </DialogHeader>

        <dl className="divide-y rounded-md border text-sm">
          {rows.map(([k, label]) => (
            <div key={k} className="grid grid-cols-3 gap-2 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{k === 'pay_rate' ? `£${kid[k]}` : kid[k]}</dd>
            </div>
          ))}
        </dl>

        {kid.status === 'acknowledged' ? (
          <p className="flex items-center gap-1.5 rounded-md bg-green-100 p-2.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">
            <CheckCircle2 size={14} /> You acknowledged this on {kid.acknowledged_at ? new Date(kid.acknowledged_at).toLocaleString('en-GB') : ''}.
          </p>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs">Type your full name to confirm you have read and understood</Label>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Your full name" />
            <Button onClick={acknowledge} disabled={busy || !signature.trim()} className="w-full">
              {busy ? 'Saving…' : 'I confirm — acknowledge'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
