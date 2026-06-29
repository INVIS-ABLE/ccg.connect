import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PALETTE = ['#f97316', '#1e3a5f', '#16a34a', '#8b5cf6', '#eab308', '#ef4444', '#0ea5e9', '#6b7280'];

function gbp(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0);
}

function countBy(rows, key) {
  const m = {};
  for (const r of rows) {
    const k = r[key] ?? 'unknown';
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.entries(m).map(([name, value]) => ({ name: String(name).replace(/_/g, ' '), value }));
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.jobs.list().catch(() => ({ jobs: [] })),
      api.invoices.list().catch(() => ({ invoices: [] })),
      api.timesheets.list().catch(() => ({ timesheets: [] })),
      api.contractors.list().catch(() => ({ contractors: [] })),
      api.leads.list().catch(() => ({ leads: [] })),
    ])
      .then(([j, i, t, c, l]) => {
        setJobs(j.jobs ?? []);
        setInvoices(i.invoices ?? []);
        setTimesheets(t.timesheets ?? []);
        setContractors(c.contractors ?? []);
        setLeads(l.leads ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const jobsByStatus = useMemo(() => countBy(jobs, 'status'), [jobs]);
  const leadsByStatus = useMemo(() => countBy(leads, 'status'), [leads]);
  const invoiceByStatus = useMemo(() => {
    const m = {};
    for (const inv of invoices) {
      const k = (inv.status ?? 'draft').replace(/_/g, ' ');
      m[k] = (m[k] ?? 0) + (inv.gross_amount ?? inv.net_amount ?? 0);
    }
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [invoices]);

  const stats = useMemo(() => {
    const active = jobs.filter((j) => !['completed', 'cancelled', 'draft'].includes(j.status)).length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const invoiced = invoices.reduce((s, i) => s + (i.gross_amount ?? i.net_amount ?? 0), 0);
    const approved = contractors.filter((c) => c.approval_status === 'approved').length;
    const openLeads = leads.filter((l) => !['converted', 'rejected'].includes(l.status)).length;
    const pendingTs = timesheets.filter((t) => t.status === 'submitted').length;
    return { active, completed, invoiced, approved, openLeads, pendingTs };
  }, [jobs, invoices, contractors, leads, timesheets]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">An overview of jobs, money, contractors and leads.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Active jobs" value={stats.active} />
            <StatCard label="Completed" value={stats.completed} />
            <StatCard label="Invoiced" value={gbp(stats.invoiced)} />
            <StatCard label="Approved contractors" value={stats.approved} />
            <StatCard label="Open leads" value={stats.openLeads} />
            <StatCard label="Timesheets to review" value={stats.pendingTs} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Jobs by status</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jobsByStatus} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Invoice value by status (£)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invoiceByStatus} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => gbp(v)} />
                    <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Leads by status</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={leadsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {leadsByStatus.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contractors by approval</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={countBy(contractors, 'approval_status')} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {countBy(contractors, 'approval_status').map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
