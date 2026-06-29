import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer';

/**
 * Quote and Contractor Report PDFs (completes the document set from step 8).
 * Same branded react-pdf pattern as InvoiceDocument; dynamically imported on
 * demand so the renderer stays out of the main bundle.
 */
const NAVY = '#1e3a5f';
const ORANGE = '#f97316';
const GREY = '#6b7280';
const CCG = { name: 'Cook Construction Growth', email: 'info@cookconstructiongrowth.co.uk', phone: '0800 123 456' };

function gbp(n) {
  if (n == null || Number.isNaN(n)) return '£—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#111827', fontFamily: 'Helvetica' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  logo: { height: 32, width: 104, objectFit: 'contain', marginBottom: 6 },
  org: { fontSize: 9, color: GREY },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: NAVY },
  meta: { fontSize: 9, color: GREY, textAlign: 'right' },
  label: { fontSize: 8, color: GREY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  strong: { fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 22 },
  th: { flexDirection: 'row', borderBottomWidth: 1.5, borderColor: '#e5e7eb', paddingBottom: 4, marginTop: 16 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#f3f4f6', paddingVertical: 5 },
  cDesc: { flex: 3 },
  cNum: { flex: 1, textAlign: 'right' },
  totals: { marginTop: 14, alignSelf: 'flex-end', width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 6, marginTop: 4 },
  grandValue: { fontFamily: 'Helvetica-Bold', color: ORANGE, fontSize: 13 },
  field: { marginTop: 12 },
  footer: { position: 'absolute', bottom: 32, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: GREY, borderTopWidth: 1, borderColor: '#f3f4f6', paddingTop: 8 },
});

function Brand({ title, sub, logoUrl }) {
  return (
    <View style={s.row}>
      <View>
        {logoUrl ? <Image src={logoUrl} style={s.logo} /> : <Text style={[s.strong, { color: NAVY, fontSize: 13 }]}>{CCG.name}</Text>}
        <Text style={s.org}>{CCG.name}</Text>
        <Text style={s.org}>{CCG.email} · {CCG.phone}</Text>
      </View>
      <View>
        <Text style={s.title}>{title}</Text>
        {sub ? <Text style={s.meta}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function QuoteDocument({ quoteNumber, dateStr, validUntil, billTo, job, lineItems = [], vatRate = 0.2, logoUrl, notes }) {
  const net = lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unitPrice) || 0), 0);
  const vat = net * vatRate;
  const gross = net + vat;
  return (
    <Document title={`Quote ${quoteNumber}`}>
      <Page size="A4" style={s.page}>
        <Brand title="QUOTE" sub={`#${quoteNumber}`} logoUrl={logoUrl} />
        <View style={[s.row, s.section]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Prepared for</Text>
            <Text style={s.strong}>{billTo?.name ?? 'Client'}</Text>
            {billTo?.line ? <Text style={s.org}>{billTo.line}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Job</Text>
            <Text style={s.strong}>{job?.title ?? ''}</Text>
            {job?.site ? <Text style={s.org}>{job.site}</Text> : null}
            <Text style={s.org}>Date: {dateStr}</Text>
            <Text style={s.org}>Valid until: {validUntil}</Text>
          </View>
        </View>

        <View style={s.th}>
          <Text style={[s.cDesc, s.label]}>Description</Text>
          <Text style={[s.cNum, s.label]}>Qty</Text>
          <Text style={[s.cNum, s.label]}>Unit</Text>
          <Text style={[s.cNum, s.label]}>Amount</Text>
        </View>
        {lineItems.length === 0 ? (
          <View style={s.tr}><Text style={[s.cDesc, { color: GREY }]}>No line items</Text></View>
        ) : (
          lineItems.map((li, i) => {
            const qty = Number(li.qty) || 0;
            const unit = Number(li.unitPrice) || 0;
            return (
              <View style={s.tr} key={i}>
                <Text style={s.cDesc}>{li.description || '—'}</Text>
                <Text style={s.cNum}>{qty}</Text>
                <Text style={s.cNum}>{gbp(unit)}</Text>
                <Text style={s.cNum}>{gbp(qty * unit)}</Text>
              </View>
            );
          })
        )}

        <View style={s.totals}>
          <View style={s.totalRow}><Text style={{ color: GREY }}>Net</Text><Text>{gbp(net)}</Text></View>
          <View style={s.totalRow}><Text style={{ color: GREY }}>VAT ({Math.round(vatRate * 100)}%)</Text><Text>{gbp(vat)}</Text></View>
          <View style={s.grand}><Text style={s.strong}>Total</Text><Text style={s.grandValue}>{gbp(gross)}</Text></View>
        </View>

        {notes ? (
          <View style={s.field}><Text style={s.label}>Notes</Text><Text>{notes}</Text></View>
        ) : null}
        <Text style={s.footer}>This quote is valid until {validUntil}. {CCG.email} · {CCG.phone}</Text>
      </Page>
    </Document>
  );
}

export function ContractorReportDocument({ contractor, credentials = [], stats = {}, dateStr, logoUrl }) {
  return (
    <Document title={`Contractor report — ${contractor?.name ?? ''}`}>
      <Page size="A4" style={s.page}>
        <Brand title="CONTRACTOR REPORT" sub={dateStr} logoUrl={logoUrl} />
        <View style={s.section}>
          <Text style={s.label}>Contractor</Text>
          <Text style={[s.strong, { fontSize: 13 }]}>{contractor?.name ?? '—'}</Text>
          <Text style={s.org}>
            {[contractor?.primary_trade, contractor?.base_postcode, contractor?.approval_status]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        <View style={[s.row, s.section]}>
          <View style={{ flex: 1 }}><Text style={s.label}>Day rate</Text><Text>{gbp(contractor?.day_rate)}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.label}>Hourly rate</Text><Text>{gbp(contractor?.hourly_rate)}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.label}>Preferred</Text><Text>{contractor?.preferred ? 'Yes' : 'No'}</Text></View>
        </View>

        <View style={[s.row, s.section]}>
          <View style={{ flex: 1 }}><Text style={s.label}>Assignments</Text><Text>{stats.assignments ?? 0}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.label}>Verified credentials</Text><Text>{stats.verified ?? 0}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.label}>Total credentials</Text><Text>{credentials.length}</Text></View>
        </View>

        <View style={s.th}>
          <Text style={[s.cDesc, s.label]}>Credential</Text>
          <Text style={[s.cNum, s.label]}>Status</Text>
          <Text style={[s.cNum, s.label]}>Expires</Text>
        </View>
        {credentials.length === 0 ? (
          <View style={s.tr}><Text style={[s.cDesc, { color: GREY }]}>No credentials on file</Text></View>
        ) : (
          credentials.map((cr, i) => (
            <View style={s.tr} key={i}>
              <Text style={s.cDesc}>{cr.name}</Text>
              <Text style={s.cNum}>{cr.status}</Text>
              <Text style={s.cNum}>{cr.expiry ?? '—'}</Text>
            </View>
          ))
        )}

        <Text style={s.footer}>Generated {dateStr} · {CCG.name} · confidential</Text>
      </Page>
    </Document>
  );
}

export function generateQuoteBlob(props) {
  return pdf(<QuoteDocument {...props} />).toBlob();
}
export function generateContractorReportBlob(props) {
  return pdf(<ContractorReportDocument {...props} />).toBlob();
}
