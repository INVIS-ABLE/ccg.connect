import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';

const DOC_TYPE_LABELS = {
  job_brief: 'Job Brief', contract: 'Contract', variation: 'Variation',
  sign_off: 'Sign Off', invoice: 'Invoice', timesheet: 'Timesheet',
  credential_pack: 'Credential Pack', other: 'Other'
};

export default function ClientDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.JobDocument.filter({ client_visible: true, archived: false }).then(d => {
      setDocuments(d);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="Documents" subtitle={`${documents.length} shared documents`} />

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : documents.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          No documents shared with you yet
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</p>
                </div>
                {doc.approval_status && (
                  <StatusBadge
                    label={doc.approval_status}
                    color={doc.approval_status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                  />
                )}
                {doc.file_url && (
                  <a href={doc.file_url} target="_blank" rel="noreferrer" download className="text-primary hover:text-primary/80">
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}