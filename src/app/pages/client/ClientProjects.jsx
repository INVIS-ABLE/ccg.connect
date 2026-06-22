import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/** A client's projects — the jobs for their organisation (API scopes by client). */
export default function ClientProjects() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.jobs
      .list()
      .then((r) => active && setJobs(r.jobs))
      .catch(() => active && setError('Could not load your projects.'));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your projects</h1>
      <Card>
        <CardContent className="pt-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!error && jobs?.length === 0 && (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          )}
          {!error && jobs && jobs.length > 0 && (
            <ul className="divide-y">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{j.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {j.trade_category ?? '—'}
                      {j.site_postcode ? ` · ${j.site_postcode}` : ''}
                    </div>
                    {j.client_visible_notes && (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {j.client_visible_notes}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{j.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
