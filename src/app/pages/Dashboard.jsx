import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { api } from '@/api/client';
import { isAdminRole } from '@/domain/auth/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Role-aware landing. Lists the jobs the API returns for the current caller
 *  (already role-scoped server-side). Real per-role screens build out from here. */
export default function Dashboard() {
  const { principal } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.jobs
      .list()
      .then((r) => active && setJobs(r.jobs))
      .catch(() => active && setError('Could not load jobs.'));
    return () => {
      active = false;
    };
  }, []);

  const role = principal?.role ?? 'contractor';
  const heading = isAdminRole(role)
    ? 'Operations dashboard'
    : role === 'client'
      ? 'Your projects'
      : 'Your jobs';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="text-muted-foreground">Signed in as {role}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!error && jobs?.length === 0 && (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          )}
          {!error && jobs && jobs.length > 0 && (
            <ul className="divide-y">
              {jobs.map((j) => (
                <li key={j.id} className="py-2">
                  <div className="font-medium">{j.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {j.status}
                    {j.site_postcode ? ` · ${j.site_postcode}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
