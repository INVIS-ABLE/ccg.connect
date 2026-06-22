import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';

export default function ClientProfile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="My Account" />

      <div className="bg-card border border-border rounded-xl p-6 mb-4 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-primary text-2xl font-bold">{user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}</span>
        </div>
        <h2 className="font-semibold text-lg">{user?.full_name || 'No name'}</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={() => base44.auth.logout()}>
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>
    </div>
  );
}