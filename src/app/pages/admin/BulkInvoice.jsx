import { useEffect, useState, useRef } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, Download, Printer } from 'lucide-react';

const VAT_RATE = 0.20;
const CCG_ADDRESS = 'Cook Construction Growth\n123 High Street\nLondon\nSW1A 1AA';
const CCG_EMAIL = 'info@cookconstructiongrowth.co.uk';
const CCG_PHONE = '0800 123 456';

function formatCurrency(n) {
  if (n == null) return '£—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function InvoicePreview({ job, timesheets, contractor, invoiceNumber }) {
  const jobTimesheets = timesheets.filter((t) => t.job_id === job.id && t.status === 'approved');
  const totalHours = jobTimesheets.reduce((s, t) => s + (t.total_hours ?? 0), 0);
  const netAmount = jobTimesheets.reduce((s, t) => s + (t.total_amount ?? 0), 0);
  const vatAmount = netAmount * VAT_RATE;
  const grossAmount = netAmount + vatAmount;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const dueDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="bg-white text-gray-900 p-8 rounded-lg shadow print:shadow-none print:rounded-none" id={`invoice-${job.id}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <img
            src="https://cookconstructiongrowth.co.uk/wp-content/uploads/2024/11/CCG-Logo.png"
            alt="CCG"
            className="h-10 mb-3 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <pre className="text-xs text-gray-500 whitespace-pre-line">{CCG_ADDRESS}</pre>
          <p className="text-xs text-gray-500">{CCG_EMAIL}</p>
          <p className="text-xs text-gray-500">{CCG_PHONE}</p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold text-gray-800">INVOICE</h2>
          <p className="text-sm text-gray-500 mt-1">#{invoiceNumber}</p>
          <p className="text-xs text-gray-400 mt-1">Date: {today}</p>
          <p className="text-xs text-gray-400">Due: {dueDate}</p>
        </div>
      </div>

      {/* Bill to / Job */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bill to</p>
          <p className="font-semibold text-sm">{contractor?.trading_name ?? contractor?.legal_name ?? 'Contractor'}</p>
          {contractor?.base_postcode && <p className="text-xs text-gray-500">{contractor.base_postcode}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Job reference</p>
          <p className="font-semibold text-sm">{job.job_reference ?? job.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-gray-500">{job.title}</p>
          <p className="text-xs text-gray-500">
            {job.site_address ? job.site_address + ' · ' : ''}{job.site_postcode ?? '—'}
          </p>
          {job.start_date && (
            <p className="text-xs text-gray-500">
              {new Date(job.start_date).toLocaleDateString('en-GB')}
              {job.end_date ? ` – ${new Date(job.end_date).toLocaleDateString('en-GB')}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Line items — timesheets */}
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 text-xs font-semibold text-gray-500">Week</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500">Hours</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500">Amount</th>
          </tr>
        </thead>
        <tbody>
          {jobTimesheets.length === 0 && (
            <tr>
              <td colSpan={3} className="py-3 text-xs text-gray-400 italic">No approved timesheets</td>
            </tr>
          )}
          {jobTimesheets.map((t) => (
            <tr key={t.id} className="border-b border-gray-100">
              <td className="py-2 text-xs text-gray-700">Week of {t.week_start}</td>
              <td className="py-2 text-right text-xs text-gray-700">{(t.total_hours ?? 0).toFixed(1)}</td>
              <td className="py-2 text-right text-xs text-gray-700">{formatCurrency(t.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-56 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total hours</span>
            <span className="font-medium">{totalHours.toFixed(1)} hrs</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Net</span>
            <span>{formatCurrency(netAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">VAT (20%)</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2 mt-1">
            <span>Total due</span>
            <span className="text-primary">{formatCurrency(grossAmount)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 pt-4 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Thank you for your work. Please quote invoice #{invoiceNumber} on your payment reference.</p>
        <p className="text-xs text-gray-400 mt-1">{CCG_EMAIL} · {CCG_PHONE}</p>
      </div>
    </div>
  );
}

export default function BulkInvoice() {
  const [jobs, setJobs] = useState(null);
  const [timesheets, setTimesheets] = useState(null);
  const [contractors, setContractors] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    api.jobs.list().then((r) => setJobs(r.jobs)).catch(() => setJobs([]));
    api.timesheets.list().then((r) => setTimesheets(r.timesheets)).catch(() => setTimesheets([]));
    api.contractors.list().then((r) => setContractors(r.contractors)).catch(() => setContractors([]));
  }, []);

  const completedJobs = jobs?.filter((j) => j.status === 'completed') ?? [];
  const contractorMap = Object.fromEntries((contractors ?? []).map((c) => [c.id, c]));

  function toggleJob(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === completedJobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(completedJobs.map((j) => j.id)));
    }
  }

  const selectedJobs = completedJobs.filter((j) => selected.has(j.id));

  function printInvoices() {
    window.print();
  }

  async function generateAndSave() {
    setGenerating(true);
    try {
      for (const job of selectedJobs) {
        const jobTs = (timesheets ?? []).filter((t) => t.job_id === job.id && t.status === 'approved');
        const net = jobTs.reduce((s, t) => s + (t.total_amount ?? 0), 0);
        if (net > 0) {
          await api.invoices.create({
            job_id: job.id,
            net_amount: net,
            invoice_type: 'ccg_to_client',
          });
        }
      }
      alert(`${selectedJobs.length} invoice(s) generated and saved.`);
    } catch {
      alert('Could not save invoices. Try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk invoice generator</h1>
        <p className="text-sm text-muted-foreground">Select completed jobs to generate invoices from approved timesheets</p>
      </div>

      {/* Job selection */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Completed jobs</CardTitle>
          {completedJobs.length > 0 && (
            <button onClick={toggleAll} className="text-xs text-primary hover:underline">
              {selected.size === completedJobs.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </CardHeader>
        <CardContent>
          {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {jobs !== null && completedJobs.length === 0 && (
            <p className="text-sm text-muted-foreground">No completed jobs yet.</p>
          )}
          <div className="divide-y">
            {completedJobs.map((j) => {
              const jobTs = (timesheets ?? []).filter((t) => t.job_id === j.id && t.status === 'approved');
              const totalHours = jobTs.reduce((s, t) => s + (t.total_hours ?? 0), 0);
              const net = jobTs.reduce((s, t) => s + (t.total_amount ?? 0), 0);
              return (
                <div key={j.id} className="flex items-center gap-4 py-3">
                  <Checkbox
                    id={`job-${j.id}`}
                    checked={selected.has(j.id)}
                    onCheckedChange={() => toggleJob(j.id)}
                  />
                  <Label htmlFor={`job-${j.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm">{j.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.site_postcode ?? '—'} · {totalHours.toFixed(1)} hrs · {formatCurrency(net)}
                    </div>
                  </Label>
                  <Badge variant="outline">{jobTs.length} timesheets</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setPreviewing((v) => !v)} className="flex items-center gap-2">
            <FileText size={16} /> {previewing ? 'Hide preview' : `Preview ${selected.size} invoice${selected.size !== 1 ? 's' : ''}`}
          </Button>
          <Button onClick={generateAndSave} disabled={generating} className="flex items-center gap-2">
            {generating ? 'Saving…' : `Save ${selected.size} invoice${selected.size !== 1 ? 's' : ''}`}
          </Button>
          {previewing && (
            <Button variant="outline" onClick={printInvoices} className="flex items-center gap-2">
              <Printer size={16} /> Print / PDF
            </Button>
          )}
        </div>
      )}

      {/* Invoice previews */}
      {previewing && (
        <div ref={printRef} className="space-y-8 print:space-y-0">
          {selectedJobs.map((job, idx) => {
            const invoiceNumber = `CCG-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`;
            const contractor = contractorMap[job.client_id] ?? null;
            return (
              <div key={job.id} className="print:page-break-after-always">
                <InvoicePreview
                  job={job}
                  timesheets={timesheets ?? []}
                  contractor={contractor}
                  invoiceNumber={invoiceNumber}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}