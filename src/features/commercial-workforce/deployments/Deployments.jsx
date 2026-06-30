import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, ChevronRight } from 'lucide-react';

const STATUS_COLOR = {
  proposed: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export default function Deployments() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.deployments.list().then((r) => setRows(r.deployments)).catch(() => setError('Could not load deployments.'));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Truck className="text-primary" size={22} /> Deployments
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Workers placed on a site against a labour request, with a frozen compliance snapshot and site chat.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && <p className="text-sm text-muted-foreground">No deployments yet — create one from a labour request.</p>}

      <div className="grid gap-3">
        {rows?.map((d) => (
          <Link key={d.id} to={`/workforce/deployments/${d.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 py-4">
                <Truck size={18} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.start_date ? `From ${d.start_date}` : 'Deployment'}{d.finish_date ? ` – ${d.finish_date}` : ''}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.confirmed_at ? `Confirmed ${new Date(d.confirmed_at).toLocaleDateString('en-GB')}` : 'Not yet confirmed'}</p>
                </div>
                <Badge className={`${STATUS_COLOR[d.status] ?? ''} capitalize`} variant="secondary">{d.status}</Badge>
                <ChevronRight size={16} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
