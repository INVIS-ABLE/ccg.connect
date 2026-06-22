import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;
    api.jobs
      .get(id)
      .then((r) => active && setJob(r.job))
      .catch(() => active && setError('Could not load job.'));
    return () => {
      active = false;
    };
  }, [id]);

  async function runMatch() {
    setMatches('loading');
    try {
      const r = await api.match.forJob(id);
      setMatches(r.matches);
    } catch {
      setMatches(null);
      setError('Could not run matching.');
    }
  }

  async function assign(contractorId) {
    setAssigning(contractorId);
    setNotice(null);
    try {
      await api.assignments.create({ job_id: id, contractor_id: contractorId });
      setNotice('Contractor assigned.');
    } catch {
      setError('Could not assign contractor.');
    } finally {
      setAssigning(null);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!job) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/jobs" className="text-sm text-muted-foreground hover:underline">
          ← Jobs
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{job.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{job.status}</Badge>
          {job.trade_category && <span>{job.trade_category}</span>}
          {job.site_postcode && <span>· {job.site_postcode}</span>}
        </div>
      </div>

      {job.short_description && (
        <Card>
          <CardContent className="pt-6 text-sm">{job.short_description}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Match candidates</CardTitle>
          <Button size="sm" onClick={runMatch} disabled={matches === 'loading'}>
            {matches === 'loading' ? 'Matching…' : 'Run match'}
          </Button>
        </CardHeader>
        <CardContent>
          {notice && <p className="mb-3 text-sm text-green-600">{notice}</p>}
          {matches === null && (
            <p className="text-sm text-muted-foreground">Run match to see ranked contractors.</p>
          )}
          {Array.isArray(matches) && matches.length === 0 && (
            <p className="text-sm text-muted-foreground">No approved contractors to match.</p>
          )}
          {Array.isArray(matches) && matches.length > 0 && (
            <ul className="divide-y">
              {matches.map((m) => (
                <li key={m.contractor_id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.trading_name ?? m.contractor_id}</span>
                      <Badge variant={m.eligible ? 'default' : 'secondary'}>
                        {m.eligible ? `Score ${m.totalScore}` : 'Ineligible'}
                      </Badge>
                    </div>
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {m.reasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!m.eligible || assigning === m.contractor_id}
                    onClick={() => assign(m.contractor_id)}
                  >
                    {assigning === m.contractor_id ? 'Assigning…' : 'Assign'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
