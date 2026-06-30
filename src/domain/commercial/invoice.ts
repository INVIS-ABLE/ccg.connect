/**
 * Commercial invoice maths — build a client invoice from charge line items and
 * apply VAT. Pure and penny-rounded. CIS/VAT treatment itself is determined by
 * the back office per the worked arrangement; this only does the arithmetic.
 */
export interface InvoiceLine {
  description: string;
  amount: number;
}

export interface InvoiceTotals {
  lineItems: InvoiceLine[];
  net: number;
  vatRate: number;
  vat: number;
  gross: number;
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function buildCommercialInvoice(
  lines: readonly InvoiceLine[],
  vatRate = 0.2,
): InvoiceTotals {
  const lineItems = lines.map((l) => ({ description: l.description, amount: r2(l.amount) }));
  const net = r2(lineItems.reduce((s, l) => s + l.amount, 0));
  const rate = Number.isFinite(vatRate) && vatRate > 0 ? vatRate : 0;
  const vat = r2(net * rate);
  return { lineItems, net, vatRate: rate, vat, gross: r2(net + vat) };
}
