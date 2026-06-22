import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { User, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import { APPROVAL_STATUSES, CREDENTIAL_STATUSES } from '@/lib/roles';
import StatusBadge from '@/components/shared/StatusBadge';

export default function ContractorProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [credTypes, setCredTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async me => {
      setUser(me);
      const [profiles, creds, types] = await Promise.all([
        base44.entities.ContractorProfile.filter({ user_id: me.id }),
        base44.entities.ContractorCredential.filter({ archived: false }),
        base44.entities.CredentialType.list(),
      ]);
      setProfile(profiles[0] || null);
      setCredentials(creds);
      setCredTypes(types);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    if (profile.id) {
      await base44.entities.ContractorProfile.update(profile.id, profile);
    } else {
      const created = await base44.entities.ContractorProfile.create({ ...profile, user_id: user.id });
      setProfile(created);
    }
    setSaving(false);
  };

  const typeMap = Object.fromEntries(credTypes.map(t => [t.id, t]));
  const myCredentials = credentials.filter(c => profile && c.contractor_id === profile.id);
  const approvalStatus = profile ? APPROVAL_STATUSES[profile.approval_status] : null;

  if (loading) return <div className="p-4 animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-xl" />)}</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="My Profile" />

      {/* Status Banner */}
      {approvalStatus && (
        <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${profile.approval_status === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <ShieldCheck className={`w-4 h-4 ${profile.approval_status === 'approved' ? 'text-green-600' : 'text-amber-600'}`} />
          <div>
            <p className="text-sm font-medium">{approvalStatus.label}</p>
            {profile.approval_status === 'pending' && <p className="text-xs text-muted-foreground">Your profile is under review</p>}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Business Details</h2>
        <div className="space-y-3">
          {[
            { label: 'Trading Name', key: 'trading_name' },
            { label: 'Primary Trade', key: 'primary_trade' },
            { label: 'Base Postcode', key: 'base_postcode' },
            { label: 'Day Rate (£)', key: 'day_rate', type: 'number' },
          ].map(({ label, key, type }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type={type || 'text'}
                value={profile?.[key] || ''}
                onChange={e => setProfile(p => ({ ...p, [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
              />
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Credentials */}
      {myCredentials.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">My Credentials</h2>
          </div>
          <div className="divide-y divide-border">
            {myCredentials.map(c => {
              const s = CREDENTIAL_STATUSES[c.verification_status];
              const type = typeMap[c.credential_type_id];
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{type?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{c.expiry_date ? `Expires ${c.expiry_date}` : 'No expiry'}</p>
                  </div>
                  {s && <StatusBadge label={s.label} color={s.color} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full gap-2" onClick={() => base44.auth.logout()}>
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>
    </div>
  );
}