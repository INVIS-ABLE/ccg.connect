import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function InvoiceTemplateModal({ invoice, onClose }) {
  const [job, setJob] = useState(null);
  const [client, setClient] = useState(null);
  const [contractor, setContractor] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();

  useEffect(() => {
    const load = async () => {
      const promises = [];
      if (invoice.job_id) promises.push(base44.entities.Job.filter({ id: invoice.job_id }).then(r => r[0]));
      else promises.push(Promise.resolve(null));

      const [jobData] = await Promise.all(promises);
      setJob(jobData);

      const extra = [];
      if (jobData?.client_id) extra.push(base44.entities.Client.filter({ id: jobData.client_id }).then(r => r[0]));
      else extra.push(Promise.resolve(null));

      if (invoice.contractor_id) extra.push(base44.entities.ContractorProfile.filter({ id: invoice.contractor_id }).then(r => r[0]));
      else if (jobData?.id) extra.push(base44.entities.JobAssignment.filter({ job_id: jobData.id, assignment_status: 'active' }).then(r => r[0] ? base44.entities.ContractorProfile.filter({ id: r[0].contractor_id }).then(r2 => r2[0]) : null));
      else extra.push(Promise.resolve(null));

      if (jobData?.id) extra.push(base44.entities.JobAssignment.filter({ job_id: jobData.id }));
      else extra.push(Promise.resolve([]));

      const [clientData, contractorData, assignmentData] = await Promise.all(extra);
      setClient(clientData);
      setContractor(contractorData);
      setAssignments(assignmentData || []);
      setLoading(false);
    };
    load();
  }, [invoice]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Invoice ${invoice.invoice_number || ''}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
        .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
        .value { font-size: 14px; font-weight: 500; }
        .total-row td { font-weight: 700; background: #fff8f3; }
        h1 { color: #F97316; margin: 0; font-size: 28px; }
        .divider { border-top: 2px solid #F97316; margin: 24px 0; }
        @media print { body { margin: 20px; } }
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  const today = format(new Date(), 'dd/MM/yyyy');
  const vatAmount = invoice.vat_amount ?? ((invoice.net_amount || 0) * (invoice.vat_rate || 20) / 100);
  const grossAmount = invoice.gross_amount ?? ((invoice.net_amount || 0) + vatAmount);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Invoice Document</DialogTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div ref={printRef} className="bg-white rounded-lg p-6 text-sm">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-[#F97316]">INVOICE</h1>
                <p className="text-muted-foreground mt-1">Cook Construction Growth Ltd</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice No.</p>
                <p className="text-lg font-bold">{invoice.invoice_number || 'DRAFT'}</p>
                <p className="text-xs text-muted-foreground mt-1">Issue Date: {invoice.issue_date || today}</p>
                <p className="text-xs text-muted-foreground">Due Date: {invoice.due_date || '—'}</p>
              </div>
            </div>

            <div className="border-t-2 border-[#F97316] my-4" />

            {/* Parties */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bill To</p>
                {client ? (
                  <>
                    <p className="font-semibold">{client.individual_or_company_name}</p>
                    {client.main_contact_name && <p className="text-muted-foreground">{client.main_contact_name}</p>}
                    {client.billing_address && <p className="text-muted-foreground whitespace-pre-line">{client.billing_address}</p>}
                    {client.email && <p className="text-muted-foreground">{client.email}</p>}
                  </>
                ) : (
                  <p className="text-muted-foreground">Client not linked</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">From</p>
                {contractor ? (
                  <>
                    <p className="font-semibold">{contractor.trading_name || contractor.legal_name}</p>
                    {contractor.base_postcode && <p className="text-muted-foreground">{contractor.base_postcode}</p>}
                    {contractor.company_number && <p className="text-muted-foreground">Co. No: {contractor.company_number}</p>}
                    {contractor.tax_or_vat_reference && <p className="text-muted-foreground">VAT: {contractor.tax_or_vat_reference}</p>}
                  </>
                ) : invoice.invoice_type === 'ccg_to_client' ? (
                  <p className="text-muted-foreground">Cook Construction Growth Ltd</p>
                ) : (
                  <p className="text-muted-foreground">Contractor not linked</p>
                )}
              </div>
            </div>

            {/* Job Details */}
            {job && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Job Details</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div><span className="text-muted-foreground">Job Ref: </span><span className="font-medium">{job.job_reference || '—'}</span></div>
                  <div><span className="text-muted-foreground">Title: </span><span className="font-medium">{job.title}</span></div>
                  <div><span className="text-muted-foreground">Site Address: </span><span className="font-medium">{job.site_address || job.site_postcode || '—'}</span></div>
                  <div><span className="text-muted-foreground">Trade: </span><span className="font-medium">{job.trade_category || '—'}</span></div>
                  {job.start_date && <div><span className="text-muted-foreground">Start: </span><span className="font-medium">{job.start_date}</span></div>}
                  {job.end_date && <div><span className="text-muted-foreground">End: </span><span className="font-medium">{job.end_date}</span></div>}
                  {assignments.length > 0 && (
                    <div className="col-span-2 mt-1">
                      <span className="text-muted-foreground">Contractors: </span>
                      <span className="font-medium">{assignments.length} assigned</span>
                    </div>
                  )}
                </div>
                {job.client_visible_notes && (
                  <p className="mt-2 text-xs text-muted-foreground border-t border-gray-200 pt-2">{job.client_visible_notes}</p>
                )}
              </div>
            )}

            {/* Line items */}
            <table className="w-full border border-border rounded mb-4 text-xs">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left font-semibold">Description</th>
                  <th className="p-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border-t border-border">
                    {job ? `Works completed: ${job.title}${job.site_address ? ` at ${job.site_address}` : ''}` : invoice.notes || 'Professional services'}
                  </td>
                  <td className="p-2 border-t border-border text-right">£{(invoice.net_amount || 0).toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td className="p-2 border-t border-border text-right text-muted-foreground">Net Amount</td>
                  <td className="p-2 border-t border-border text-right">£{(invoice.net_amount || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="p-2 border-t border-border text-right text-muted-foreground">VAT ({invoice.vat_rate ?? 20}%)</td>
                  <td className="p-2 border-t border-border text-right">£{vatAmount.toFixed(2)}</td>
                </tr>
                <tr className="bg-orange-50 font-bold">
                  <td className="p-2 border-t-2 border-[#F97316] text-right">Total Due</td>
                  <td className="p-2 border-t-2 border-[#F97316] text-right text-[#F97316]">£{grossAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            {invoice.notes && (
              <p className="text-xs text-muted-foreground border-t border-border pt-3">Notes: {invoice.notes}</p>
            )}

            <div className="border-t border-border mt-6 pt-4 text-center text-xs text-muted-foreground">
              Cook Construction Growth Ltd — cookconstructiongrowth.co.uk — Generated {today}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}