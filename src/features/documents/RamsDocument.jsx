import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import { sectionDefs, requiresHazards, riskRating } from '@/domain/forms/rams';

/**
 * RAMS / Method Statement as a branded PDF. Dynamically imported so
 * @react-pdf/renderer stays out of the main bundle. Pure presentation — the
 * content shape and risk maths come from src/domain/forms/rams.
 */
const NAVY = '#1e3a5f';
const ORANGE = '#f97316';
const GREY = '#6b7280';
const BAND_COLOR = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };

const CCG = { name: 'Cook Construction Growth', email: 'info@cookconstructiongrowth.co.uk', phone: '0800 123 456' };
const TYPE_LABEL = { rams: 'Risk Assessment & Method Statement', method_statement: 'Method Statement' };

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#111827', fontFamily: 'Helvetica', lineHeight: 1.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  org: { fontSize: 9, color: GREY, lineHeight: 1.4 },
  docTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: NAVY },
  docType: { fontSize: 9, color: ORANGE, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  meta: { fontSize: 9, color: GREY, marginTop: 2, textAlign: 'right' },
  metaBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderColor: '#e5e7eb' },
  metaItem: { },
  label: { fontSize: 8, color: GREY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  strong: { fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 16, marginBottom: 4 },
  body: { fontSize: 10, color: '#111827' },
  hazHead: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 4, paddingHorizontal: 4, marginTop: 6 },
  hazRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 4 },
  cHaz: { flex: 3, paddingRight: 4 },
  cWho: { flex: 2, paddingRight: 4 },
  cRisk: { flex: 1.4, paddingRight: 4 },
  cCtrl: { flex: 3, paddingRight: 4 },
  cRes: { flex: 1.4 },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: GREY, borderTopWidth: 1, borderColor: '#f3f4f6', paddingTop: 8 },
});

function Risk({ likelihood, severity }) {
  const { score, band } = riskRating(likelihood, severity);
  return <Text style={{ color: BAND_COLOR[band], fontFamily: 'Helvetica-Bold' }}>{score} ({band})</Text>;
}

export function RamsDocument({ doc }) {
  const content = doc?.content ?? { sections: {}, hazards: [] };
  const defs = sectionDefs();
  return (
    <Document title={doc?.title ?? 'RAMS'}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={[s.strong, { color: NAVY, fontSize: 14 }]}>{CCG.name}</Text>
            <Text style={s.org}>{CCG.email}</Text>
            <Text style={s.org}>{CCG.phone}</Text>
          </View>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.docType}>{TYPE_LABEL[doc?.form_type] ?? 'RAMS'}</Text>
            <Text style={s.docTitle}>{doc?.title ?? 'Untitled'}</Text>
            {doc?.reference ? <Text style={s.meta}>Ref: {doc.reference}</Text> : null}
            <Text style={s.meta}>Version {doc?.version ?? 1} · {doc?.status ?? 'draft'}</Text>
            {doc?.issued_at ? <Text style={s.meta}>Issued {new Date(doc.issued_at).toLocaleDateString('en-GB')}</Text> : null}
          </View>
        </View>

        <View style={s.metaBar}>
          {doc?.site_name ? (
            <View style={s.metaItem}><Text style={s.label}>Site</Text><Text style={s.strong}>{doc.site_name}</Text></View>
          ) : null}
          {doc?.prepared_by ? (
            <View style={s.metaItem}><Text style={s.label}>Prepared by</Text><Text style={s.strong}>{doc.prepared_by}</Text></View>
          ) : null}
        </View>

        {/* Narrative sections */}
        {defs.map((def) => {
          const text = (content.sections?.[def.key] ?? '').trim();
          if (!text) return null;
          return (
            <View key={def.key} wrap={false}>
              <Text style={s.sectionTitle}>{def.title}</Text>
              <Text style={s.body}>{text}</Text>
            </View>
          );
        })}

        {/* Risk assessment */}
        {requiresHazards(doc?.form_type) && (content.hazards?.length ?? 0) > 0 && (
          <View>
            <Text style={s.sectionTitle}>Risk assessment</Text>
            <View style={s.hazHead}>
              <Text style={[s.cHaz, s.label]}>Hazard</Text>
              <Text style={[s.cWho, s.label]}>Who&apos;s at risk</Text>
              <Text style={[s.cRisk, s.label]}>Initial</Text>
              <Text style={[s.cCtrl, s.label]}>Controls</Text>
              <Text style={[s.cRes, s.label]}>Residual</Text>
            </View>
            {content.hazards.map((h, i) => (
              <View style={s.hazRow} key={i} wrap={false}>
                <Text style={s.cHaz}>{h.hazard}</Text>
                <Text style={s.cWho}>{h.who_at_risk}</Text>
                <Text style={s.cRisk}><Risk likelihood={h.likelihood} severity={h.severity} /></Text>
                <Text style={s.cCtrl}>{h.controls}</Text>
                <Text style={s.cRes}><Risk likelihood={h.residual_likelihood} severity={h.residual_severity} /></Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer}>
          {CCG.name} · {doc?.title ?? ''}{doc?.reference ? ` · ${doc.reference}` : ''} · {CCG.email}
        </Text>
      </Page>
    </Document>
  );
}

/** Render a RAMS / Method Statement document to a PDF Blob (for download). */
export function generateRamsBlob(doc) {
  return pdf(<RamsDocument doc={doc} />).toBlob();
}
