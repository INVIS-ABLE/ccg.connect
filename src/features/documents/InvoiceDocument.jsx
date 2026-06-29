import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer';

/**
 * Branded CCG invoice as a real PDF (upgrade plan, step 8) — replaces printing a
 * screenshot of an HTML page. This module is dynamically imported on demand so
 * @react-pdf/renderer stays out of the main bundle.
 */
const NAVY = '#1e3a5f';
const ORANGE = '#f97316';
const GREY = '#6b7280';

const CCG = {
  name: 'Cook Construction Growth',
  address: ['123 High Street', 'London', 'SW1A 1AA'],
  email: 'info@cookconstructiongrowth.co.uk',
  phone: '0800 123 456',
};

function gbp(n) {
  if (n == null) return '£—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#111827', fontFamily: 'Helvetica' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  logo: { height: 34, width: 110, objectFit: 'contain', marginBottom: 8 },
  org: { fontSize: 9, color: GREY, lineHeight: 1.4 },
  invoiceTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: NAVY },
  meta: { fontSize: 9, color: GREY, marginTop: 2, textAlign: 'right' },
  section: { marginTop: 24 },
  label: { fontSize: 8, color: GREY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  strong: { fontFamily: 'Helvetica-Bold' },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1.5, borderColor: '#e5e7eb', paddingBottom: 4, marginTop: 18 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#f3f4f6', paddingVertical: 5 },
  cDesc: { flex: 3 },
  cNum: { flex: 1, textAlign: 'right' },
  totals: { marginTop: 14, alignSelf: 'flex-end', width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 6, marginTop: 4 },
  grandValue: { fontFamily: 'Helvetica-Bold', color: ORANGE, fontSize: 13 },
  footer: { position: 'absolute', bottom: 32, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: GREY, borderTopWidth: 1, borderColor: '#f3f4f6', paddingTop: 8 },
});

export function InvoiceDocument({ invoiceNumber, dateStr, dueStr, billTo, job, lineItems = [], net = 0, vatRate = 0.2, logoUrl }) {
  const vat = net * vatRate;
  const gross = net + vat;
  return (
    <Document title={`Invoice ${invoiceNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            {logoUrl ? <Image src={logoUrl} style={s.logo} /> : <Text style={[s.strong, { color: NAVY, fontSize: 14 }]}>{CCG.name}</Text>}
            <Text style={s.org}>{CCG.name}</Text>
            {CCG.address.map((l) => (
              <Text key={l} style={s.org}>{l}</Text>
            ))}
            <Text style={s.org}>{CCG.email}</Text>
            <Text style={s.org}>{CCG.phone}</Text>
          </View>
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.meta}>#{invoiceNumber}</Text>
            <Text style={s.meta}>Date: {dateStr}</Text>
            <Text style={s.meta}>Due: {dueStr}</Text>
          </View>
        </View>

        <View style={[s.row, s.section]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.strong}>{billTo?.name ?? 'Client'}</Text>
            {billTo?.line ? <Text style={s.org}>{billTo.line}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Job</Text>
            <Text style={s.strong}>{job?.reference ?? ''}</Text>
            <Text style={s.org}>{job?.title ?? ''}</Text>
            {job?.site ? <Text style={s.org}>{job.site}</Text> : null}
            {job?.dates ? <Text style={s.org}>{job.dates}</Text> : null}
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.cDesc, s.label]}>Description</Text>
          <Text style={[s.cNum, s.label]}>Hours</Text>
          <Text style={[s.cNum, s.label]}>Amount</Text>
        </View>
        {lineItems.length === 0 ? (
          <View style={s.tableRow}>
            <Text style={[s.cDesc, { color: GREY }]}>No line items</Text>
          </View>
        ) : (
          lineItems.map((li, i) => (
            <View style={s.tableRow} key={i}>
              <Text style={s.cDesc}>{li.description}</Text>
              <Text style={s.cNum}>{li.hours != null ? li.hours.toFixed(1) : '—'}</Text>
              <Text style={s.cNum}>{gbp(li.amount)}</Text>
            </View>
          ))
        )}

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={{ color: GREY }}>Net</Text>
            <Text>{gbp(net)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={{ color: GREY }}>VAT ({Math.round(vatRate * 100)}%)</Text>
            <Text>{gbp(vat)}</Text>
          </View>
          <View style={s.grand}>
            <Text style={s.strong}>Total due</Text>
            <Text style={s.grandValue}>{gbp(gross)}</Text>
          </View>
        </View>

        <Text style={s.footer}>
          Please quote invoice #{invoiceNumber} on your payment. {CCG.email} · {CCG.phone}
        </Text>
      </Page>
    </Document>
  );
}

/** Render the invoice to a PDF Blob (for download). */
export function generateInvoiceBlob(props) {
  return pdf(<InvoiceDocument {...props} />).toBlob();
}
