import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/DataTable';

const NEXT_STATUS = {
  new: ['contacted', 'rejected'],
  contacted: ['qualified', 'rejected'],
  qualified: ['converted', 'rejected'],
};

export default function Leads() {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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
        return (
          <div className="flex justify-end gap-2">
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
    </div>
  );
}
