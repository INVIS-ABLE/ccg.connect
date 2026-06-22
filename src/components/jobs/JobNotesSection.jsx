import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic, Send, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import VoiceToolbar from '@/components/voice/VoiceToolbar';

export default function JobNotesSection({ jobId, existingNotes, onSaved, userRole = 'contractor' }) {
  const [notes, setNotes] = useState(existingNotes || '');
  const [saving, setSaving] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const field = userRole === 'contractor' ? 'client_visible_notes' : 'internal_notes';
    await base44.entities.Job.update(jobId, { [field]: notes });
    toast.success('Notes saved');
    onSaved?.(notes);
    setSaving(false);
  };

  const handleTranscript = (text) => {
    setNotes(prev => prev ? prev + ' ' + text : text);
    setShowVoice(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-primary" />
          {userRole === 'contractor' ? 'Job Notes' : 'Internal Notes'}
        </h2>
        <button
          onClick={() => setShowVoice(v => !v)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-muted hover:bg-muted/70 transition-colors"
          title="Use voice input"
        >
          <Mic className="w-3.5 h-3.5" />
          Voice
        </button>
      </div>

      <Textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder={userRole === 'contractor' ? 'Add site notes, progress updates, issues encountered...' : 'Internal admin notes (not visible to contractor or client)...'}
        rows={4}
        className="mb-3 resize-none"
      />

      <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
        <Send className="w-3.5 h-3.5" />
        {saving ? 'Saving...' : 'Save Notes'}
      </Button>

      {showVoice && (
        <div className="mt-3">
          <VoiceToolbar onTranscript={handleTranscript} />
        </div>
      )}
    </div>
  );
}