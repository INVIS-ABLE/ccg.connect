import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BulkInvoiceModal({ jobs, onClose, onCreated }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const due = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd');

  const [invoiceType, setInvoiceType] = useState('ccg_to_client');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(due);
  const [vatRate, setVatRate] = useState(20);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);
  const [created, setCreated] = useState([]);

  const handleCreate = async () => {
    setCreating(true);
    const results = [];
    let counter = 1;

    for (const job of jobs) {
      const invoiceNumber = `CCG-INV-${format(new Date(), 'yyyy')}-${String(counter++).padStart(4, '0')}-${job.id.slice(-4).toUpperCase()}`;
      const netAmount = job.budget || 0;
      const vatAmount = (netAmount * vatRate) / 100;
      const grossAmount = netAmount + vatAmount;

      const invoice = await base44.entities.Invoice.create({
        job_id: job.id,
        client_id: job.client_id || null,
        invoice_number: invoiceNumber,
        invoice_type: invoiceType,
        issue_date: issueDate,
        due_date: dueDate,
        net_amount: netAmount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        gross_amount: grossAmount,
        status: 'draft',
        notes: `Auto-generated invoice for job: ${job.title}`,
      });
      results.push({ job, invoice });
    }

    setCreated(results);
    setCreating(false);
    setDone(true);
    toast.success(`${results.length} invoice${results.length > 1 ? 's' : ''} created`);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {done ? 'Invoices Created' : `Generate ${jobs.length} Invoice${jobs.length > 1 ? 's' : ''}`}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 pt-2">
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {created.map(({ job, invoice }) => (
                <div key={invoice.id} className="flex items-center gap-3 px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{invoice.invoice_number}</p>
                  </div>
                  <span className="text-sm font-semibold">£{(invoice.gross_amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <Button onClick={() => { onCreated(); onClose(); }} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Job list preview */}
            <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center gap-2 text-sm">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{job.title}</span>
                  <span className="text-muted-foreground flex-shrink-0">£{(job.budget || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Invoice Type</Label>
                <Select value={invoiceType} onValueChange={setInvoiceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ccg_to_client">CCG → Client</SelectItem>
                    <SelectItem value="contractor_to_ccg">Contractor → CCG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>VAT Rate (%)</Label>
                <Input type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))} min={0} max={100} />
              </div>
              <div>
                <Label>Issue Date</Label>
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Net</span>
                <span className="font-medium">£{jobs.reduce((s, j) => s + (j.budget || 0), 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">VAT ({vatRate}%)</span>
                <span className="font-medium">£{(jobs.reduce((s, j) => s + (j.budget || 0), 0) * vatRate / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1 font-semibold">
                <span>Total Gross</span>
                <span>£{(jobs.reduce((s, j) => s + (j.budget || 0), 0) * (1 + vatRate / 100)).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="flex-1 bg-[#F97316] hover:bg-[#ea6a0a] text-white">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Creating…</> : `Create ${jobs.length} Invoice${jobs.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}