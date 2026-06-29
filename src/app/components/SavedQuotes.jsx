import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const STATUS_VARIANT = { draft: 'outline', sent: 'secondary', accepted: 'default', declined: 'destructive', expired: 'outline' };
const NEXT = { draft: ['sent'], sent: ['accepted', 'declined'] };

function gbp(n) {
  if (n == null) return '£—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

/** Lists saved quotes for a job, with status changes and PDF re-download. */
export function SavedQuotes({ job, refresh }) {
  const [quotes, setQuotes] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    try {
      const r = await api.quotes.list(job.id);
      setQuotes(r.quotes);
    } catch {
      setQuotes([]);
    }
  }
  useEffect(() => {
    void load();
  }, [job.id, refresh]);

  async function setStatus(id, status) {
    setBusy(id);
    try {
      await api.quotes.update(id, { status });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function download(q) {
    setBusy(q.id);
    try {
      const lineItems = (() => {
        try {
          return JSON.parse(q.line_items ?? '[]');
        } catch {
          return [];
        }
      })();
      const longDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '');
      const mod = await import('@/features/documents/businessDocuments');
      const blob = await mod.generateQuoteBlob({
        quoteNumber: q.quote_number ?? q.id.slice(0, 8),
        dateStr: longDate(q.created_at),
        validUntil: longDate(q.valid_until),
        billTo: { name: q.recipient_name || 'Client', line: '' },
        job: { title: job.title, site: [job.site_address, job.site_postcode].filter(Boolean).join(' · ') },
        lineItems,
        vatRate: (q.vat_rate ?? 20) / 100,
        notes: q.notes,
        logoUrl: `${window.location.origin}/ccg-logo.png`,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${q.quote_number ?? 'quote'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  if (quotes === null) return <p className="text-sm text-muted-foreground">Loading saved quotes…</p>;
  if (quotes.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved quotes</p>
      {quotes.map((q) => (
        <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="font-medium">{q.quote_number ?? '—'}</span>
          <span className="text-muted-foreground">{gbp(q.gross_amount)}</span>
          <Badge variant={STATUS_VARIANT[q.status] ?? 'outline'}>{q.status}</Badge>
          <div className="ml-auto flex items-center gap-2">
            {(NEXT[q.status] ?? []).map((s) => (
              <Button key={s} size="sm" variant="outline" disabled={busy === q.id} onClick={() => setStatus(q.id, s)}>
                Mark {s}
              </Button>
            ))}
            <Button size="sm" variant="ghost" disabled={busy === q.id} onClick={() => download(q)} className="gap-1.5">
              <Download size={14} /> PDF
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
