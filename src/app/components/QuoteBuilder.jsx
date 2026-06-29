import { useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Download, Save } from 'lucide-react';

const VAT_RATE = 0.2;

function gbp(n) {
  if (n == null || Number.isNaN(n)) return '£0.00';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

/** Inline quote builder: add line items, see live totals, and download a branded
 *  Quote PDF. Client-side only (not persisted) — generate-and-send for now. */
export function QuoteBuilder({ job, onSaved }) {
  const [recipient, setRecipient] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ description: '', qty: 1, unitPrice: 0 }]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  function quoteNumber() {
    return `Q-${new Date().getFullYear()}-${String(Math.floor(Date.now() / 1000) % 10000).padStart(4, '0')}`;
  }

  async function save() {
    setSaving(true);
    try {
      await api.quotes.create({
        job_id: job.id,
        client_id: job.client_id ?? undefined,
        quote_number: quoteNumber(),
        recipient_name: recipient || undefined,
        line_items: lines,
        vat_rate: Math.round(VAT_RATE * 100),
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        notes: notes || undefined,
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const net = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const vat = net * VAT_RATE;
  const gross = net + vat;

  function setLine(i, patch) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { description: '', qty: 1, unitPrice: 0 }]);
  }
  function removeLine(i) {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));
  }

  async function download() {
    setBusy(true);
    try {
      const longDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const quoteNumber = `Q-${new Date().getFullYear()}-${String(Math.floor(Date.now() / 1000) % 10000).padStart(4, '0')}`;
      const mod = await import('@/features/documents/businessDocuments');
      const blob = await mod.generateQuoteBlob({
        quoteNumber,
        dateStr: longDate(new Date()),
        validUntil: longDate(new Date(Date.now() + 30 * 86400000)),
        billTo: { name: recipient || 'Client', line: '' },
        job: {
          title: job.title,
          site: [job.site_address, job.site_postcode].filter(Boolean).join(' · '),
        },
        lineItems: lines,
        vatRate: VAT_RATE,
        notes,
        logoUrl: `${window.location.origin}/ccg-logo.png`,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quoteNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input placeholder="Quote for (recipient name)" value={recipient} onChange={(e) => setRecipient(e.target.value)} />

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Description"
              value={l.description}
              onChange={(e) => setLine(i, { description: e.target.value })}
            />
            <Input
              className="w-16"
              type="number"
              min="0"
              placeholder="Qty"
              value={l.qty}
              onChange={(e) => setLine(i, { qty: e.target.value })}
            />
            <Input
              className="w-24"
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit £"
              value={l.unitPrice}
              onChange={(e) => setLine(i, { unitPrice: e.target.value })}
            />
            <button type="button" onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove line">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
        <Plus size={14} /> Add line
      </Button>

      <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <div className="text-muted-foreground">
          Net {gbp(net)} · VAT {gbp(vat)}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Total {gbp(gross)}</span>
          <Button size="sm" variant="outline" disabled={saving} onClick={save} className="gap-1.5">
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" disabled={busy} onClick={download} className="gap-1.5">
            <Download size={14} /> {busy ? 'Generating…' : 'Download'}
          </Button>
        </div>
      </div>
    </div>
  );
}
