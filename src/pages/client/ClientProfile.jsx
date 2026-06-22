import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

      <Button variant="outline" className="w-full gap-2 mb-3" onClick={() => base44.auth.logout()}>
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>

      {/* Delete Account */}
      <div className="bg-card border border-destructive/30 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h2>
        <p className="text-xs text-muted-foreground mb-3">Deleting your account is permanent and cannot be undone.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full gap-2">
              <Trash2 className="w-4 h-4" /> Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This action is permanent. Your account and all associated data will be removed and cannot be recovered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => base44.auth.logout()}
              >
                Yes, delete my account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}