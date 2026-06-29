import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/DataTable';

const STATUS_VARIANT = {
  submitted: 'secondary',
  approved: 'default',
  needs_correction: 'destructive',
  disputed: 'destructive',
  exported: 'outline',
  paid: 'default',
  draft: 'outline',
};

function gbp(n) {
  if (n == null) return '£—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export default function Timesheets() {
  const [rows, setRows] = useState(null);
  const [jobs, setJobs] = useState({});
  const [contractors, setContractors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    try {
      const [ts, j, c] = await Promise.all([
        api.timesheets.list(),
        api.jobs.list().catch(() => ({ jobs: [] })),
        api.contractors.list().catch(() => ({ contractors: [] })),
      ]);
      setRows(ts.timesheets);
      setJobs(Object.fromEntries((j.jobs ?? []).map((x) => [x.id, x.title])));
      setContractors(
        Object.fromEntries((c.contractors ?? []).map((x) => [x.id, x.trading_name ?? x.legal_name ?? 'Contractor'])),
      );
    } catch {
      setError('Could not load timesheets.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function review(id, status) {
    setBusy(id);
    try {
      await api.timesheets.review(id, { status });
      await load();
    } catch {
      setError('Could not update timesheet.');
    } finally {
      setBusy(null);
    }
  }

  const columns = [
    {
      id: 'contractor',
      accessorFn: (r) => contractors[r.contractor_id] ?? r.contractor_id,
      header: 'Contractor',
      meta: { exportLabel: 'Contractor' },
      cell: (i) => <span className="font-medium">{i.getValue()}</span>,
    },
    {
      id: 'job',
      accessorFn: (r) => jobs[r.job_id] ?? '—',
      header: 'Job',
      meta: { exportLabel: 'Job' },
      cell: (i) => i.getValue(),
    },
    { id: 'week', accessorFn: (r) => r.week_start ?? '', header: 'Week', meta: { exportLabel: 'Week' }, cell: (i) => i.getValue() || '—' },
    {
      id: 'hours',
      accessorFn: (r) => r.total_hours ?? 0,
      header: 'Hours',
      meta: { exportLabel: 'Hours' },
      cell: (i) => (i.getValue() ?? 0).toFixed(1),
    },
    {
      id: 'amount',
      accessorFn: (r) => r.total_amount ?? 0,
      header: 'Amount',
      meta: { exportLabel: 'Amount' },
      cell: (i) => gbp(i.getValue()),
    },
    {
      id: 'status',
      accessorFn: (r) => r.status,
      header: 'Status',
      meta: { exportLabel: 'Status' },
      cell: (i) => (
        <Badge variant={STATUS_VARIANT[i.getValue()] ?? 'secondary'}>{String(i.getValue()).replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex justify-end gap-2">
            {(t.status === 'submitted' || t.status === 'needs_correction') && (
              <>
                <Button size="sm" disabled={busy === t.id} onClick={() => review(t.id, 'approved')}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={busy === t.id} onClick={() => review(t.id, 'needs_correction')}>
                  Return
                </Button>
              </>
            )}
            {t.status === 'approved' && (
              <Button size="sm" variant="outline" disabled={busy === t.id} onClick={() => review(t.id, 'paid')}>
                Mark paid
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Timesheets</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        data={rows ?? []}
        getRowId={(r) => r.id}
        loading={rows === null && !error}
        emptyMessage="No timesheets submitted yet."
        searchPlaceholder="Search timesheets…"
        exportFilename="timesheets.csv"
      />
    </div>
  );
}
