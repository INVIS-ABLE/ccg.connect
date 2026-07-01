import { sectionDefs, requiresHazards, riskRating } from '@/domain/forms/rams';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const BAND_TONE = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const blankHazard = () => ({
  hazard: '', who_at_risk: '', likelihood: 1, severity: 1, controls: '', residual_likelihood: 1, residual_severity: 1,
});

function RiskBadge({ likelihood, severity }) {
  const { score, band } = riskRating(likelihood, severity);
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${BAND_TONE[band]}`}>{score} · {band}</span>;
}

function ScoreSelect({ value, onChange, label }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
      {label}
      <select
        className="h-8 rounded-md border border-input bg-background px-1 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}

/**
 * Editor for the shared RamsContent shape (narrative sections + hazard table).
 * Used by both the template editor and the filled-document editor. `content` is
 * controlled; every change calls onChange with the next content object.
 */
export function RamsContentEditor({ formType, content, onChange }) {
  const setSection = (key, value) => onChange({ ...content, sections: { ...content.sections, [key]: value } });
  const setHazard = (i, patch) => {
    const hazards = content.hazards.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    onChange({ ...content, hazards });
  };
  const addHazard = () => onChange({ ...content, hazards: [...content.hazards, blankHazard()] });
  const removeHazard = (i) => onChange({ ...content, hazards: content.hazards.filter((_h, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* Narrative sections */}
      <div className="space-y-4">
        {sectionDefs(formType).map((s) => (
          <div key={s.key}>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium">
              {s.title}
              {s.required && <span className="text-xs font-normal text-muted-foreground">(required)</span>}
            </label>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={content.sections[s.key] ?? ''}
              onChange={(e) => setSection(s.key, e.target.value)}
              placeholder={`Describe ${s.title.toLowerCase()}…`}
            />
          </div>
        ))}
      </div>

      {/* Hazard table (RAMS only) */}
      {requiresHazards(formType) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Risk assessment — hazards</h3>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addHazard}>
              <Plus size={13} /> Add hazard
            </Button>
          </div>
          {content.hazards.length === 0 && (
            <p className="text-xs text-muted-foreground">No hazards yet. Add at least one before issuing a RAMS.</p>
          )}
          {content.hazards.map((h, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="flex items-start gap-2">
                <input
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium"
                  placeholder="Hazard"
                  value={h.hazard}
                  onChange={(e) => setHazard(i, { hazard: e.target.value })}
                />
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => removeHazard(i)}>
                  <Trash2 size={14} />
                </Button>
              </div>
              <input
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                placeholder="Who is at risk?"
                value={h.who_at_risk}
                onChange={(e) => setHazard(i, { who_at_risk: e.target.value })}
              />
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-xs text-muted-foreground">Initial</span>
                <ScoreSelect label="Likelihood" value={h.likelihood} onChange={(v) => setHazard(i, { likelihood: v })} />
                <ScoreSelect label="Severity" value={h.severity} onChange={(v) => setHazard(i, { severity: v })} />
                <RiskBadge likelihood={h.likelihood} severity={h.severity} />
              </div>
              <textarea
                className="min-h-[56px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                placeholder="Control measures"
                value={h.controls}
                onChange={(e) => setHazard(i, { controls: e.target.value })}
              />
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-xs text-muted-foreground">Residual</span>
                <ScoreSelect label="Likelihood" value={h.residual_likelihood} onChange={(v) => setHazard(i, { residual_likelihood: v })} />
                <ScoreSelect label="Severity" value={h.residual_severity} onChange={(v) => setHazard(i, { residual_severity: v })} />
                <RiskBadge likelihood={h.residual_likelihood} severity={h.residual_severity} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
