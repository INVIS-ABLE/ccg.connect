import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight } from 'lucide-react';
import { DataTable } from '@/components/data-table/DataTable';
import { leadToJobDraft, leadToClientDraft } from '@/domain/leads/convert';

const NEXT_STATUS = {
  new: ['contacted', 'rejected'],
  contacted: ['qualified', 'rejected'],
  qualified: ['rejected'],
};

const URGENCIES = ['low', 'medium', 'high', 'emergency'];

/**
 * One-click lead → job conversion. Pre-fills an editable job (and optionally a
 * linked client) from the lead, creates them, and marks the lead converted —
 * removing manual re-entry. Reuses existing endpoints; nothing is created until
 * the admin confirms.
 */
function ConvertLeadDialog({ lead, onClose, onConverted }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [job, setJob] = useState(() => leadToJobDraft(lead));
  const [client, setClient] = useState(() => leadToClientDraft(lead));
  const [createClient, setCreateClient] = useState(true);
  const [busy, setBusy] = useState(false);

  async function convert() {
    if (!job.title.trim()) {
      toast({ title: 'Title required', description: 'Give the job a title.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      let clientId;
      if (createClient) {
        const r = await api.clients.create({
          individual_or_company_name: client.individual_or_company_name.trim() || 'New client',
          client_type: client.client_type,
          main_contact_name: client.main_contact_name ?? undefined,
          email: client.email ?? undefined,
          phone: client.phone ?? undefined,
          default_postcode: client.default_postcode ?? undefined,
        });
        clientId = r.client.id;
      }
      const created = await api.jobs.create({
        title: job.title.trim(),
        short_description: job.short_description || undefined,
        site_postcode: job.site_postcode || undefined,
        trade_category: job.trade_category || undefined,
        urgency: job.urgency,
        client_id: clientId,
      });
      await api.leads.update(lead.id, { status: 'converted' });
      toast({ title: 'Lead converted', description: `Job “${created.job.title}” created.` });
      onConverted();
      navigate(`/jobs/${created.job.id}`);
    } catch {
      toast({ title: 'Could not convert', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert lead to job</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cv-title">Job title</Label>
            <Input id="cv-title" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cv-desc">Description</Label>
            <Input id="cv-desc" value={job.short_description ?? ''} onChange={(e) => setJob({ ...job, short_description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cv-pc">Site postcode</Label>
              <Input id="cv-pc" value={job.site_postcode ?? ''} onChange={(e) => setJob({ ...job, site_postcode: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cv-trade">Trade</Label>
              <Input id="cv-trade" value={job.trade_category ?? ''} onChange={(e) => setJob({ ...job, trade_category: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cv-urgency">Urgency</Label>
            <select
              id="cv-urgency"
              value={job.urgency}
              onChange={(e) => setJob({ ...job, urgency: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm capitalize"
            >
              {URGENCIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 border-t pt-3 text-sm">
            <input type="checkbox" checked={createClient} onChange={(e) => setCreateClient(e.target.checked)} />
            <span>Also create a client from this lead and link it</span>
          </label>
          {createClient && (
            <div className="grid gap-1.5">
              <Label htmlFor="cv-client">Client name</Label>
              <Input
                id="cv-client"
                value={client.individual_or_company_name}
                onChange={(e) => setClient({ ...client, individual_or_company_name: e.target.value })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={convert} disabled={busy} className="gap-1.5">
            <ArrowRight size={15} /> {busy ? 'Converting…' : 'Create job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(null); // the lead being converted

  async function load() {
    try {
      const r = await api.leads.list();
      setLeads(r.leads);
    } catch {
      setError('Could not load leads.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id, status) {
    setBusy(true);
    try {
      await api.leads.update(id, { status });
      await load();
    } catch {
      setError('Could not update lead.');
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      id: 'name',
      accessorFn: (r) => r.name ?? '',
      header: 'Name',
      meta: { exportLabel: 'Name' },
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    },
    { id: 'email', accessorFn: (r) => r.email ?? '', header: 'Email', meta: { exportLabel: 'Email' }, cell: (i) => i.getValue() || '—' },
    { id: 'company', accessorFn: (r) => r.company ?? '', header: 'Company', meta: { exportLabel: 'Company' }, cell: (i) => i.getValue() || '—' },
    { id: 'work_type', accessorFn: (r) => r.work_type ?? '', header: 'Work type', meta: { exportLabel: 'Work type' }, cell: (i) => i.getValue() || '—' },
    { id: 'postcode', accessorFn: (r) => r.site_postcode ?? '', header: 'Postcode', meta: { exportLabel: 'Postcode' }, cell: (i) => i.getValue() || '—' },
    {
      id: 'status',
      accessorFn: (r) => r.status,
      header: 'Status',
      meta: { exportLabel: 'Status' },
      cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const l = row.original;
        const canConvert = l.status !== 'converted' && l.status !== 'rejected';
        return (
          <div className="flex justify-end gap-2">
            {canConvert && (
              <Button size="sm" className="gap-1" disabled={busy} onClick={() => setConverting(l)}>
                <ArrowRight size={13} /> Convert to job
              </Button>
            )}
            {(NEXT_STATUS[l.status] ?? []).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === 'rejected' ? 'outline' : 'default'}
                disabled={busy}
                onClick={() => setStatus(l.id, s)}
              >
                {s}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        data={leads ?? []}
        getRowId={(r) => r.id}
        loading={leads === null && !error}
        emptyMessage="No leads yet."
        searchPlaceholder="Search leads…"
        exportFilename="leads.csv"
      />
      {converting && (
        <ConvertLeadDialog
          lead={converting}
          onClose={() => setConverting(null)}
          onConverted={() => {
            setConverting(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
