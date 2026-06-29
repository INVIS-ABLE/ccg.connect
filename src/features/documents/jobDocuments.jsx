import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer';

/**
 * Job-related PDF documents (follow-up to step 8): a Job Sheet and a Completion
 * Record, both branded and built from the job record. Dynamically imported on
 * demand so @react-pdf/renderer stays out of the main bundle.
 */
const NAVY = '#1e3a5f';
const ORANGE = '#f97316';
const GREY = '#6b7280';

const CCG = { name: 'Cook Construction Growth', email: 'info@cookconstructiongrowth.co.uk', phone: '0800 123 456' };

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#111827', fontFamily: 'Helvetica' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  logo: { height: 32, width: 104, objectFit: 'contain', marginBottom: 6 },
  org: { fontSize: 9, color: GREY },
  docTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: NAVY },
  meta: { fontSize: 9, color: GREY, textAlign: 'right' },
  band: { backgroundColor: '#f3f4f6', borderRadius: 4, padding: 8, marginTop: 18 },
  label: { fontSize: 8, color: GREY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  strong: { fontFamily: 'Helvetica-Bold' },
  field: { marginTop: 12 },
  grid2: { flexDirection: 'row', gap: 24, marginTop: 12 },
  col: { flex: 1 },
  sigRow: { flexDirection: 'row', gap: 24, marginTop: 40 },
  sigBox: { flex: 1 },
  sigLine: { borderTopWidth: 1, borderColor: '#9ca3af', marginTop: 28, paddingTop: 4, fontSize: 8, color: GREY },
  footer: { position: 'absolute', bottom: 32, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: GREY, borderTopWidth: 1, borderColor: '#f3f4f6', paddingTop: 8 },
});

function Header({ title, job, logoUrl }) {
  return (
    <>
      <View style={s.row}>
        <View>
          {logoUrl ? <Image src={logoUrl} style={s.logo} /> : <Text style={[s.strong, { color: NAVY, fontSize: 13 }]}>{CCG.name}</Text>}
          <Text style={s.org}>{CCG.name}</Text>
          <Text style={s.org}>{CCG.email} · {CCG.phone}</Text>
        </View>
        <View>
          <Text style={s.docTitle}>{title}</Text>
          <Text style={s.meta}>{job?.reference ?? ''}</Text>
        </View>
      </View>
      <View style={s.band}>
        <Text style={s.label}>Job</Text>
        <Text style={s.strong}>{job?.title ?? ''}</Text>
        {job?.site ? <Text style={s.org}>{job.site}</Text> : null}
        {job?.dates ? <Text style={s.org}>{job.dates}</Text> : null}
      </View>
    </>
  );
}

function Field({ label, value }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Text>{value || '—'}</Text>
    </View>
  );
}

export function JobSheetDocument({ job, logoUrl }) {
  return (
    <Document title={`Job sheet ${job?.reference ?? ''}`}>
      <Page size="A4" style={s.page}>
        <Header title="JOB SHEET" job={job} logoUrl={logoUrl} />
        <View style={s.grid2}>
          <View style={s.col}><Field label="Trade" value={job?.trade} /></View>
          <View style={s.col}><Field label="Urgency" value={job?.urgency} /></View>
          <View style={s.col}><Field label="Status" value={job?.status} /></View>
        </View>
        <Field label="Scope of work" value={job?.description} />
        {job?.clientNotes ? <Field label="Client notes" value={job.clientNotes} /> : null}
        <Field label="Work completed / notes on site" value={' '} />
        <View style={{ height: 60, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, marginTop: 4 }} />
        <View style={s.sigRow}>
          <View style={s.sigBox}><Text style={s.sigLine}>Contractor signature / date</Text></View>
          <View style={s.sigBox}><Text style={s.sigLine}>Client signature / date</Text></View>
        </View>
        <Text style={s.footer}>{CCG.name} · {CCG.email} · {CCG.phone}</Text>
      </Page>
    </Document>
  );
}

export function CompletionDocument({ job, completedDate, logoUrl }) {
  return (
    <Document title={`Completion record ${job?.reference ?? ''}`}>
      <Page size="A4" style={s.page}>
        <Header title="COMPLETION RECORD" job={job} logoUrl={logoUrl} />
        <Field label="Completion date" value={completedDate} />
        <Field
          label="Declaration"
          value="The works described above have been completed to the agreed standard and the site left in a satisfactory condition."
        />
        <Field label="Outstanding items / snagging" value={' '} />
        <View style={{ height: 50, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, marginTop: 4 }} />
        <View style={s.sigRow}>
          <View style={s.sigBox}><Text style={s.sigLine}>Contractor — name, signature, date</Text></View>
          <View style={s.sigBox}><Text style={s.sigLine}>Client — name, signature, date</Text></View>
        </View>
        <Text style={s.footer}>{CCG.name} · {CCG.email} · {CCG.phone}</Text>
      </Page>
    </Document>
  );
}

export function generateJobSheetBlob(props) {
  return pdf(<JobSheetDocument {...props} />).toBlob();
}
export function generateCompletionBlob(props) {
  return pdf(<CompletionDocument {...props} />).toBlob();
}
