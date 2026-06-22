import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';

export default function Settings() {
  const [credentialTypes, setCredentialTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCategory, setNewTypeCategory] = useState('other');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.CredentialType.list().then(data => {
      setCredentialTypes(data);
      setLoading(false);
    });
  }, []);

  const handleAddType = async () => {
    if (!newTypeName) return;
    setSaving(true);
    const created = await base44.entities.CredentialType.create({ name: newTypeName, category: newTypeCategory, active: true });
    setCredentialTypes(prev => [...prev, created]);
    setNewTypeName('');
    setSaving(false);
  };

  const handleToggleType = async (id, active) => {
    await base44.entities.CredentialType.update(id, { active: !active });
    setCredentialTypes(prev => prev.map(t => t.id === id ? { ...t, active: !active } : t));
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="Platform configuration" />

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Credential Types</h2>
        </div>

        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <Input
              placeholder="Credential name (e.g. CSCS Card)"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              className="flex-1"
            />
            <select
              value={newTypeCategory}
              onChange={e => setNewTypeCategory(e.target.value)}
              className="px-3 py-2 border border-input rounded-md text-sm bg-background"
            >
              {['safety_card', 'gas_registration', 'trade_qualification', 'working_at_height', 'asbestos', 'first_aid', 'management', 'insurance', 'other'].map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <Button onClick={handleAddType} disabled={saving || !newTypeName} size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-12 mx-4 my-2 bg-muted rounded animate-pulse" />)
          ) : credentialTypes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No credential types configured</div>
          ) : (
            credentialTypes.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{t.category?.replace(/_/g, ' ')}</p>
                </div>
                <button
                  onClick={() => handleToggleType(t.id, t.active)}
                  className={`text-xs px-2 py-1 rounded font-medium ${t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {t.active ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}