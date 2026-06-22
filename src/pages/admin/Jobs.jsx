import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { JOB_STATUSES } from '@/lib/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const STATUS_FILTERS = ['all', 'draft', 'ready_to_match', 'offers_sent', 'assigned', 'in_progress', 'completed', 'cancelled'];
const UPDATABLE_STATUSES = ['draft', 'ready_to_match', 'in_progress', 'on_hold', 'completed', 'cancelled'];

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    base44.entities.Job.filter({ archived: false }).then(data => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  const filtered = jobs.filter(j => {
    const matchSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.job_reference?.toLowerCase().includes(search.toLowerCase()) || j.site_postcode?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleSelect = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(j => j.id)));
    }
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setUpdating(true);
    await Promise.all([...selected].map(id => base44.entities.Job.update(id, { status: bulkStatus })));
    setJobs(prev => prev.map(j => selected.has(j.id) ? { ...j, status: bulkStatus } : j));
    toast.success(`${selected.size} job${selected.size > 1 ? 's' : ''} updated to "${JOB_STATUSES[bulkStatus]?.label || bulkStatus}"`);
    setSelected(new Set());
    setBulkStatus('');
    setUpdating(false);
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} total jobs`}
        actions={
          <Link to="/jobs/new">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> New Job
            </Button>
          </Link>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setSelected(new Set()); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            {s === 'all' ? 'All' : JOB_STATUSES[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="flex-1" />
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Change status to…" />
            </SelectTrigger>
            <SelectContent>
              {UPDATABLE_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{JOB_STATUSES[s]?.label || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyBulkStatus} disabled={!bulkStatus || updating} className="h-8 text-xs bg-[#F97316] hover:bg-[#ea6a0a] text-white">
            {updating ? 'Updating…' : 'Apply'}
          </Button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <p>No jobs found</p>
              <Link to="/jobs/new"><Button variant="outline" size="sm" className="mt-3">Create first job</Button></Link>
            </div>
          ) : (
            <>
              {/* Select-all header */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
                <button onClick={toggleAll} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${allSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                    {allSelected && <span className="text-white text-[10px]">✓</span>}
                    {someSelected && !allSelected && <span className="text-primary text-[10px]">—</span>}
                  </div>
                  {allSelected ? 'Deselect all' : `Select all ${filtered.length}`}
                </button>
              </div>
              <div className="divide-y divide-border">
                {filtered.map(job => {
                  const s = JOB_STATUSES[job.status];
                  const isSelected = selected.has(job.id);
                  return (
                    <div key={job.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      {/* Checkbox */}
                      <button
                        onClick={e => toggleSelect(job.id, e)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                      >
                        {isSelected && <span className="text-white text-[10px]">✓</span>}
                      </button>
                      {/* Row — clickable to detail */}
                      <Link to={`/jobs/${job.id}`} className="flex flex-1 items-center gap-4 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold truncate">{job.title}</p>
                            {job.urgency === 'emergency' && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">URGENT</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{job.job_reference || 'No ref'} • {job.site_postcode || 'No postcode'}</p>
                        </div>
                        {s && <StatusBadge label={s.label} color={s.color} />}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}