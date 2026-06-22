import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Briefcase, HardHat, FileText } from 'lucide-react';

export default function Reports() {
  const [jobs, setJobs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Job.filter({ archived: false }),
      base44.entities.ContractorProfile.filter({ archived: false }),
      base44.entities.Invoice.list('-created_date', 200),
    ]).then(([j, c, i]) => {
      setJobs(j);
      setContractors(c);
      setInvoices(i);
      setLoading(false);
    });
  }, []);

  const jobsByStatus = Object.entries(
    jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {})
  ).map(([status, count]) => ({ status: status.replace(/_/g, ' '), count }));

  const totalRevenue = invoices.filter(i => i.status === 'paid' && i.invoice_type === 'ccg_to_client').reduce((sum, i) => sum + (i.gross_amount || 0), 0);
  const totalCost = invoices.filter(i => i.status === 'paid' && i.invoice_type === 'contractor_to_ccg').reduce((sum, i) => sum + (i.gross_amount || 0), 0);

  if (loading) return <div className="p-6 animate-pulse"><div className="h-40 bg-muted rounded-xl" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Reports" subtitle="Overview of business performance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Jobs" value={jobs.length} icon={Briefcase} subtitle={`${jobs.filter(j => j.status === 'completed').length} completed`} />
        <StatCard title="Active Contractors" value={contractors.filter(c => c.approval_status === 'approved').length} icon={HardHat} color="text-blue-600" />
        <StatCard title="Total Revenue" value={`£${totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} icon={FileText} color="text-green-600" subtitle="Paid invoices to CCG" />
        <StatCard title="Total Costs" value={`£${totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} icon={FileText} color="text-red-600" subtitle="Paid to contractors" />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-sm mb-4">Jobs by Status</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={jobsByStatus} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="status" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-2">Profit Margin</h2>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-xl font-bold text-green-600">£{totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Costs</p>
            <p className="text-xl font-bold text-red-600">£{totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Margin</p>
            <p className="text-xl font-bold text-foreground">£{(totalRevenue - totalCost).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}