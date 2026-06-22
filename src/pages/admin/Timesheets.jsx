import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { TIMESHEET_STATUSES } from '@/lib/roles';
import TimesheetDetailModal from '@/components/timesheets/TimesheetDetailModal';

const STATUS_FILTERS = ['all', 'submitted', 'needs_correction', 'approved', 'paid', 'disputed'];

export default function Timesheets() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const loadTimesheets = () => {
    base44.entities.Timesheet.list('-created_date', 100).then(data => {
      setTimesheets(data);
      setLoading(false);
    });
  };

  useEffect(() => { loadTimesheets(); }, []);

  const filtered = timesheets.filter(t => {
    const matchSearch = !search || t.week_start?.includes(search) || t.job_id?.includes(search);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });


  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="Timesheets" subtitle={`${timesheets.length} total timesheets`} />

      {selectedId && (
        <TimesheetDetailModal
          timesheetId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={loadTimesheets}
        />
      )}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search timesheets..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {s === 'all' ? 'All' : TIMESHEET_STATUSES[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No timesheets found</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(t => {
                const s = TIMESHEET_STATUSES[t.status];
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedId(t.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Week of {t.week_start}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.total_hours ? `${t.total_hours}h` : 'TBC'} {t.total_amount ? `• £${t.total_amount.toFixed(2)}` : ''}
                      </p>
                    </div>
                    {s && <StatusBadge label={s.label} color={s.color} />}
                    {t.status === 'submitted' && (
                      <span className="text-xs text-primary font-medium ml-1">Review →</span>
                    )}
                    <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}