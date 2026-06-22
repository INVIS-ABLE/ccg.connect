import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

const urgencyStyle = (days) => {
  if (days <= 7)  return { bg: 'bg-red-50 border-red-200',   badge: 'bg-red-100 text-red-700',   dot: 'bg-red-500',   label: `${days}d` };
  if (days <= 30) return { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: `${days}d` };
  return            { bg: 'bg-yellow-50 border-yellow-100',  badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', label: `${days}d` };
};

export default function ExpiringCredentialsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + 60);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    Promise.all([
      base44.entities.ContractorCredential.filter({ archived: false, verification_status: 'verified' }),
      base44.entities.CredentialType.list(),
      base44.entities.ContractorProfile.filter({ archived: false }),
    ]).then(([creds, types, profiles]) => {
      const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
      const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

      const expiring = creds
        .filter(c => c.expiry_date && c.expiry_date <= cutoffStr)
        .map(c => {
          const days = differenceInDays(parseISO(c.expiry_date), today);
          const profile = profileMap[c.contractor_id] || {};
          const type = typeMap[c.credential_type_id] || {};
          return { ...c, days, contractorName: profile.trading_name || profile.legal_name || 'Unknown', credentialName: type.name || 'Credential' };
        })
        .sort((a, b) => a.days - b.days)
        .slice(0, 8);

      setItems(expiring);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-sm">Expiring Credentials</h2>
        </div>
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-sm">Expiring Credentials</h2>
          {items.length > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">{items.length}</span>
          )}
        </div>
        <Link to="/compliance" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <ShieldAlert className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-sm font-medium text-green-700">All credentials valid</p>
          <p className="text-xs text-muted-foreground mt-0.5">No expirations in the next 60 days</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map(item => {
            const style = urgencyStyle(item.days);
            return (
              <Link
                key={item.id}
                to="/compliance"
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.contractorName}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.credentialName}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${style.badge}`}>
                  {item.days <= 0 ? 'EXPIRED' : `${item.days}d`}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}