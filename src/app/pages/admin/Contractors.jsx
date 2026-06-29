import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/DataTable';

const STATUS_VARIANT = {
  approved: 'default',
  pending: 'secondary',
  suspended: 'destructive',
  rejected: 'destructive',
  archived: 'outline',
};

export default function Contractors() {
  const [contractors, setContractors] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.contractors.list();
      setContractors(r.contractors);
    } catch {
      setError('Could not load contractors.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function setStatus(ids, approval_status) {
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => api.contractors.update(id, { approval_status })));
      await load();
    } catch {
      setError('Could not update contractor.');
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      id: 'name',
      accessorFn: (r) => r.trading_name ?? r.legal_name ?? 'Unnamed contractor',
      header: 'Name',
      meta: { exportLabel: 'Name' },
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    },
    {
      id: 'trade',
      accessorFn: (r) => r.primary_trade ?? '',
      header: 'Trade',
      meta: { exportLabel: 'Trade' },
      cell: (info) => info.getValue() || '—',
    },
    {
      id: 'postcode',
      accessorFn: (r) => r.base_postcode ?? '',
      header: 'Postcode',
      meta: { exportLabel: 'Postcode' },
      cell: (info) => info.getValue() || '—',
    },
    {
      id: 'status',
      accessorFn: (r) => r.approval_status,
      header: 'Status',
      meta: { exportLabel: 'Status' },
      cell: (info) => <Badge variant={STATUS_VARIANT[info.getValue()] ?? 'secondary'}>{info.getValue()}</Badge>,
    },
    {
      id: 'preferred',
      accessorFn: (r) => (r.preferred_contractor ? 'Preferred' : ''),
      header: 'Preferred',
      meta: { exportLabel: 'Preferred' },
      cell: (info) => (info.getValue() ? <Badge variant="outline">Preferred</Badge> : null),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const ct = row.original;
        return (
          <div className="flex justify-end gap-2">
            {ct.approval_status !== 'approved' && (
              <Button size="sm" disabled={busy} onClick={() => setStatus([ct.id], 'approved')}>
                Approve
              </Button>
            )}
            {ct.approval_status !== 'suspended' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus([ct.id], 'suspended')}>
                Suspend
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Contractors</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        data={contractors ?? []}
        getRowId={(r) => r.id}
        loading={contractors === null && !error}
        emptyMessage="No contractors yet."
        searchPlaceholder="Search contractors…"
        exportFilename="contractors.csv"
        enableSelection
        renderBulkActions={(rows, clear) => (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                await setStatus(rows.map((r) => r.id), 'approved');
                clear();
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                await setStatus(rows.map((r) => r.id), 'suspended');
                clear();
              }}
            >
              Suspend
            </Button>
          </>
        )}
      />
    </div>
  );
}
