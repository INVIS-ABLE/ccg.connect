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
  const [reportId, setReportId] = useState(null);

  async function downloadReport(ct) {
    setReportId(ct.id);
    setError(null);
    try {
      const [creds, types, assigns] = await Promise.all([
        api.credentials.list(ct.id),
        api.credentials.types(),
        api.assignments.list().catch(() => ({ assignments: [] })),
      ]);
      const typeName = (id) => types.credentialTypes.find((t) => t.id === id)?.name ?? id;
      const credentials = (creds.credentials ?? []).map((cr) => ({
        name: typeName(cr.credential_type_id),
        status: cr.verification_status.replace(/_/g, ' '),
        expiry: cr.expiry_date,
      }));
      const verified = (creds.credentials ?? []).filter((cr) => cr.verification_status === 'verified').length;
      const assignments = (assigns.assignments ?? []).filter((a) => a.contractor_id === ct.id).length;
      const mod = await import('@/features/documents/businessDocuments');
      const blob = await mod.generateContractorReportBlob({
        contractor: {
          name: ct.trading_name ?? ct.legal_name ?? 'Contractor',
          primary_trade: ct.primary_trade,
          base_postcode: ct.base_postcode,
          approval_status: ct.approval_status,
          day_rate: ct.day_rate,
          hourly_rate: ct.hourly_rate,
          preferred: ct.preferred_contractor,
        },
        credentials,
        stats: { verified, assignments },
        dateStr: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        logoUrl: `${window.location.origin}/ccg-logo.png`,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contractor-report-${(ct.trading_name ?? ct.id).replace(/\s+/g, '-').toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not generate contractor report.');
    } finally {
      setReportId(null);
    }
  }

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
            <Button size="sm" variant="ghost" disabled={reportId === ct.id} onClick={() => downloadReport(ct)}>
              {reportId === ct.id ? 'Report…' : 'Report'}
            </Button>
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
