import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/app/auth/AuthProvider';
import { isOwnerRole } from '@/domain/auth/roles';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, User, Briefcase, Building2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLE_META = {
  owner:      { label: 'Owner',      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  ops_admin:  { label: 'Ops Admin',  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  contractor: { label: 'Contractor', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  client:     { label: 'Client',     color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
};

function roleMeta(role) {
  return ROLE_META[role] ?? { label: role, color: 'bg-muted text-muted-foreground' };
}

// Roles that any admin can assign
const STANDARD_ROLES = ['contractor', 'client'];

export default function UserManagement() {
  const { principal } = useAuth();
  const isOwner = isOwnerRole(principal?.role);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [confirmGrant, setConfirmGrant] = useState(null); // userId to confirm ops_admin grant
  const { toast } = useToast();

  useEffect(() => {
    api.get('/admin/users').then((r) => setUsers(r.data)).finally(() => setLoading(false));
  }, []);

  async function changeRole(userId, newRole) {
    setUpdating(userId);
    setConfirmGrant(null);
    try {
      const res = await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: res.data.role } : u)));
      toast({ title: 'Role updated', description: `User is now ${roleMeta(newRole).label}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Shield size={20} className="text-primary" /> User Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage roles for all registered users.
          {isOwner && ' As Owner, you can also grant Operations Admin status.'}
        </p>
      </div>

      {/* Owner-only info banner */}
      {isOwner && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
          <Shield size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-semibold">Owner access:</span> You can grant Operations Admin status to trusted users.
            Ops Admins have full access to all admin tools except user role management.
          </p>
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading users…</p>}
      {!loading && users?.length === 0 && <p className="text-muted-foreground text-sm">No users found yet.</p>}

      <div className="grid gap-4">
        {users?.map((user) => {
          const meta = roleMeta(user.role);
          const displayName = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed user';
          const isSelf = user.id === principal?.id;
          const isConfirming = confirmGrant === user.id;

          return (
            <Card key={user.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4">
                {/* Avatar + name */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {displayName}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email ?? '—'}</p>
                  </div>
                </div>

                {/* Current role badge */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.color}`}>
                  {meta.label}
                </span>

                {/* Action buttons — skip for self and owners */}
                {!isSelf && user.role !== 'owner' && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Standard role buttons — visible to all admins */}
                    {STANDARD_ROLES.filter((r) => r !== user.role).map((r) => (
                      <Button
                        key={r}
                        variant="outline"
                        size="sm"
                        disabled={updating === user.id}
                        onClick={() => changeRole(user.id, r)}
                      >
                        Make {roleMeta(r).label}
                      </Button>
                    ))}

                    {/* Grant Ops Admin — owner only, with confirmation */}
                    {isOwner && user.role !== 'ops_admin' && (
                      isConfirming ? (
                        <div className="flex items-center gap-2 border border-amber-300 rounded-md px-2 py-1 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
                          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                          <span className="text-xs text-amber-800 dark:text-amber-300">Grant admin access?</span>
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                            disabled={updating === user.id}
                            onClick={() => changeRole(user.id, 'ops_admin')}
                          >
                            {updating === user.id ? 'Granting…' : 'Confirm'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => setConfirmGrant(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30 flex items-center gap-1"
                          disabled={updating === user.id}
                          onClick={() => setConfirmGrant(user.id)}
                        >
                          <Shield size={12} />
                          Grant Admin Status
                        </Button>
                      )
                    )}

                    {/* Revoke ops_admin — owner only */}
                    {isOwner && user.role === 'ops_admin' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                        disabled={updating === user.id}
                        onClick={() => changeRole(user.id, 'client')}
                      >
                        Revoke admin
                      </Button>
                    )}
                  </div>
                )}

                {isSelf && (
                  <span className="text-xs text-muted-foreground italic">Cannot edit your own role</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}