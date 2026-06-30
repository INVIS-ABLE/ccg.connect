import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Truck, HardHat, Receipt, TrendingUp, CalendarCheck, ShieldAlert, Lock, MapPin, UserX, Inbox, FileClock, Wallet } from 'lucide-react';

const PALETTE = ['#f97316', '#1e3a5f', '#16a34a', '#8b5cf6', '#eab308', '#ef4444', '#0ea5e9', '#6b7280'];

const gbp = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0);
const titleCase = (s) => String(s).replace(/_/g, ' ');

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {Icon && <Icon size={14} />}
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p className={`mt-1 text-2xl font-bold ${tone ?? ''}`}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function CommercialDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    api.dashboard
      .commercial(months)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [months]);

  const trend = useMemo(() => {
    if (!data) return [];
    return data.revenueTrend.map((b, i) => ({
      label: b.label,
      revenue: Math.round(b.value),
      margin: Math.round(data.marginTrend[i]?.value ?? 0),
    }));
  }, [data]);

  const deploymentPie = useMemo(
    () => (data ? Object.entries(data.deploymentsByStatus).map(([name, value]) => ({ name: titleCase(name), value })) : []),
    [data],
  );
  const accountBars = useMemo(
    () => (data ? data.revenueByAccount.map((r) => ({ name: r.label, value: Math.round(r.value) })) : []),
    [data],
  );
  const incidentBars = useMemo(
    () => (data ? Object.entries(data.incidentsBySeverity).map(([name, value]) => ({ name: titleCase(name), value })) : []),
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Commercial dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agency performance — deployments, revenue, margin and reliability.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <Lock size={12} /> Margins &amp; cost are CCG-only
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">Could not load the dashboard. Please try again.</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Truck} label="Active deployments" value={data.kpis.activeDeployments} />
            <StatCard icon={HardHat} label="Workers deployed" value={data.kpis.workersDeployed} />
            <StatCard icon={Receipt} label="Revenue (issued+paid)" value={gbp(data.kpis.revenue)} sub={`${gbp(data.kpis.outstanding)} outstanding`} />
            <StatCard icon={TrendingUp} label="Margin" value={gbp(data.kpis.margin)} sub={`${data.kpis.marginPct}% of charge`} tone="text-green-700 dark:text-green-400" />
            <StatCard icon={CalendarCheck} label="Attendance (30d)" value={`${data.kpis.attendanceRate}%`} sub={`${data.attendance.total} records`} />
            <StatCard
              icon={ShieldAlert}
              label="Open incidents"
              value={data.kpis.openIncidents}
              tone={data.kpis.openIncidents > 0 ? 'text-amber-700 dark:text-amber-400' : ''}
            />
          </div>

          {/* Today — operational picture */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={MapPin} label="On site today" value={data.kpis.workersOnSiteToday} />
            <StatCard
              icon={UserX}
              label="Absent today"
              value={data.kpis.absentToday}
              tone={data.kpis.absentToday > 0 ? 'text-red-700 dark:text-red-400' : ''}
            />
            <StatCard icon={Inbox} label="Open requests" value={data.kpis.openRequests} />
            <StatCard
              icon={FileClock}
              label="Timesheets to approve"
              value={data.kpis.timesheetsAwaitingApproval}
              tone={data.kpis.timesheetsAwaitingApproval > 0 ? 'text-amber-700 dark:text-amber-400' : ''}
            />
            <StatCard icon={Wallet} label="Payroll exposure" value={gbp(data.kpis.payrollExposure)} sub="approved, not yet invoiced" />
          </div>

          {/* Trends */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trends</h2>
            <div className="flex gap-1 rounded-md border p-0.5">
              {[6, 12].map((m) => (
                <Button key={m} size="sm" variant={months === m ? 'default' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setMonths(m)}>
                  {m}m
                </Button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue &amp; margin (£/month)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => gbp(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#1e3a5f" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="margin" name="Margin" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by account (£)</CardTitle></CardHeader>
              <CardContent className="h-64">
                {accountBars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No invoiced revenue yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accountBars} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => gbp(v)} />
                      <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Deployments by status</CardTitle></CardHeader>
              <CardContent className="h-64">
                {deploymentPie.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No deployments yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deploymentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {deploymentPie.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Margin breakdown + incidents */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Margin breakdown (all timesheets)</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Client charge" value={gbp(data.margin.clientCharge)} />
                <Row label="Worker pay" value={`− ${gbp(data.margin.workerPay)}`} />
                <Row label="Employer on-cost" value={`− ${gbp(data.margin.employerCost)}`} />
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>CCG margin</span>
                  <span className="text-green-700 dark:text-green-400">{gbp(data.margin.margin)} · {data.margin.marginPct}%</span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Figures are arithmetic only — CIS/PAYE/VAT status is set per worker by payroll/tax specialists, not derived here.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Open incidents by severity</CardTitle>
                <Link to="/workforce/incidents"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View all</Button></Link>
              </CardHeader>
              <CardContent className="h-56">
                {incidentBars.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldAlert size={13} /> No open incidents.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incidentBars} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{data.kpis.openRequests} open labour request{data.kpis.openRequests === 1 ? '' : 's'}</Badge>
            <Link to="/workforce/deployments"><Button size="sm" variant="outline">Deployments</Button></Link>
            <Link to="/workforce/requests"><Button size="sm" variant="outline">Labour requests</Button></Link>
            <Link to="/reports"><Button size="sm" variant="outline">Construction reports</Button></Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
