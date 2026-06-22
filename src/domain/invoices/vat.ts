import { round2 } from '../shared/number';

/**
 * UK VAT calculation for invoices. Pure and unit-tested (CLAUDE.md: VAT,
 * rounding). All money rounded to the penny.
 */
export interface VatBreakdown {
  net: number;
  vatRate: number;
  vat: number;
  gross: number;
}

/** Compute VAT and gross from a net amount and a VAT rate (percent, e.g. 20). */
export function computeVat(net: number, vatRatePercent = 20): VatBreakdown {
  if (net < 0) throw new Error('net amount must not be negative');
  if (vatRatePercent < 0) throw new Error('VAT rate must not be negative');
  const netR = round2(net);
  const vat = round2(netR * (vatRatePercent / 100));
  return { net: netR, vatRate: vatRatePercent, vat, gross: round2(netR + vat) };
}

/** Sum line nets, then apply VAT once to the total (avoids per-line rounding drift). */
export function invoiceTotals(lineNets: number[], vatRatePercent = 20): VatBreakdown {
  const net = round2(lineNets.reduce((sum, n) => sum + n, 0));
  return computeVat(net, vatRatePercent);
}
