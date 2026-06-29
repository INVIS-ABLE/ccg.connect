import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';

const SUGGESTED_SKILLS = [
  'General building', 'Carpentry', 'Joinery', 'Electrical', 'Plumbing', 'Heating & gas',
  'Plastering', 'Painting & decorating', 'Roofing', 'Groundworks', 'Landscaping',
  'Tiling', 'Flooring', 'Brickwork', 'Masonry', 'Steel fabrication', 'Scaffolding',
  'Damp proofing', 'Insulation', 'CCTV & security', 'Drainage', 'Concrete',
  'Demolition', 'Asbestos removal', 'Windows & glazing', 'Paving',
];

/** Controlled skill-tag editor. `value` = string[] of skills, `onChange` = (string[]) => void */
export default function SkillTagger({ value = [], onChange }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = SUGGESTED_SKILLS.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()),
  );

  function addSkill(skill) {
    const trimmed = skill.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
    setShowSuggestions(false);
  }

  function removeSkill(skill) {
    onChange(value.filter((s) => s !== skill));
  }

  function handleKey(e) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addSkill(input);
    }
    if (e.key === 'Backspace' && !input && value.length) {
      removeSkill(value[value.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      {/* Current tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="hover:text-destructive transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          placeholder="Type a skill and press Enter, or pick below…"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKey}
          className="pr-8"
        />
        {input.trim() && (
          <button
            type="button"
            onClick={() => addSkill(input)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary"
          >
            <Plus size={16} />
          </button>
        )}

        {/* Dropdown suggestions */}
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
            {filtered.slice(0, 10).map((s) => (
              <button
                key={s}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                onMouseDown={() => addSkill(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick-add chips when input is empty */}
      {!input && value.length < 8 && (
        <div className="flex flex-wrap gap-1">
          {SUGGESTED_SKILLS.filter((s) => !value.includes(s)).slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSkill(s)}
              className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus size={10} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}