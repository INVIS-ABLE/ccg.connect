import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/data-table/DataTable';

const STATUS_VARIANT = { active: 'default', inactive: 'outline', suspended: 'destructive' };
const TYPES = ['individual', 'company', 'housing_association', 'local_authority', 'other'];
const EMPTY = {
  individual_or_company_name: '',
  client_type: 'company',
  main_contact_name: '',
  email: '',
  phone: '',
  default_postcode: '',
};

export default function Clients() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.clients.list();
      setRows(r.clients);
    } catch {
      setError('Could not load clients.');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.individual_or_company_name.trim()) return;
    setSaving(true);
    try {
      await api.clients.create(form);
      setForm(EMPTY);
      setOpen(false);
      await load();
    } catch {
      setError('Could not add client.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id, account_status) {
    setBusy(id);
    try {
      await api.clients.update(id, { account_status });
      await load();
    } catch {
      setError('Could not update client.');
    } finally {
      setBusy(null);
    }
  }

  const columns = [
    {
      id: 'name',
      accessorFn: (r) => r.individual_or_company_name ?? '',
      header: 'Name',
      meta: { exportLabel: 'Name' },
      cell: (i) => <span className="font-medium">{i.getValue()}</span>,
    },
    {
      id: 'type',
      accessorFn: (r) => (r.client_type ?? '').replace(/_/g, ' '),
      header: 'Type',
      meta: { exportLabel: 'Type' },
      cell: (i) => i.getValue() || '—',
    },
    { id: 'contact', accessorFn: (r) => r.main_contact_name ?? '', header: 'Contact', meta: { exportLabel: 'Contact' }, cell: (i) => i.getValue() || '—' },
    { id: 'email', accessorFn: (r) => r.email ?? '', header: 'Email', meta: { exportLabel: 'Email' }, cell: (i) => i.getValue() || '—' },
    { id: 'postcode', accessorFn: (r) => r.default_postcode ?? '', header: 'Postcode', meta: { exportLabel: 'Postcode' }, cell: (i) => i.getValue() || '—' },
    {
      id: 'status',
      accessorFn: (r) => r.account_status,
      header: 'Status',
      meta: { exportLabel: 'Status' },
      cell: (i) => <Badge variant={STATUS_VARIANT[i.getValue()] ?? 'secondary'}>{i.getValue()}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const cl = row.original;
        return (
          <div className="flex justify-end gap-2">
            {cl.account_status !== 'active' && (
              <Button size="sm" disabled={busy === cl.id} onClick={() => setStatus(cl.id, 'active')}>
                Activate
              </Button>
            )}
            {cl.account_status !== 'suspended' && (
              <Button size="sm" variant="outline" disabled={busy === cl.id} onClick={() => setStatus(cl.id, 'suspended')}>
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button onClick={() => setOpen((v) => !v)}>{open ? 'Cancel' : 'Add client'}</Button>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Add client</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required value={form.individual_or_company_name} onChange={(e) => setForm({ ...form, individual_or_company_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctype">Type</Label>
                <select
                  id="ctype"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
                  value={form.client_type}
                  onChange={(e) => setForm({ ...form, client_type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Main contact</Label>
                <Input id="contact" value={form.main_contact_name} onChange={(e) => setForm({ ...form, main_contact_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc">Default postcode</Label>
                <Input id="pc" value={form.default_postcode} onChange={(e) => setForm({ ...form, default_postcode: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add client'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        data={rows ?? []}
        getRowId={(r) => r.id}
        loading={rows === null && !error}
        emptyMessage="No clients yet."
        searchPlaceholder="Search clients…"
        exportFilename="clients.csv"
      />
    </div>
  );
}
