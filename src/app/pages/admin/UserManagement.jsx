import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, User, Briefcase, Building2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLES = [
  { value: 'owner', label: 'Owner', icon: Shield, color: 'bg-purple-100 text-purple-800' },
  { value: 'ops_admin', label: 'Ops Admin', icon: Shield, color: 'bg-blue-100 text-blue-800' },
  { value: 'contractor', label: 'Contractor', icon: Briefcase, color: 'bg-amber-100 text-amber-800' },
  { value: 'client', label: 'Client', icon: Building2, color: 'bg-green-100 text-green-800' },
];

function roleMeta(role) {
  return ROLES.find((r) => r.value === role) ?? { label: role, color: 'bg-muted text-muted-foreground' };
}

export default function UserManagement() {
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get('/admin/users').then((r) => setUsers(r.data)).finally(() => setLoading(false));
  }, []);

  async function changeRole(userId, newRole) {
    setUpdating(userId);
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
        <h1 className="text-2xl font-heading font-bold">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Promote or change roles for app users</p>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Loading users…</p>}

      {!loading && users?.length === 0 && (
        <p className="text-muted-foreground text-sm">No users found yet.</p>
      )}

      <div className="grid gap-4">
        {users?.map((user) => {
          const meta = roleMeta(user.role);
          return (
            <Card key={user.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <User size={16} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed user'}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email ?? '—'}</p>
                  </div>
                </div>

                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${meta.color}`}>
                  {meta.label}
                </span>

                <div className="flex flex-wrap gap-2">
                  {ROLES.filter((r) => r.value !== user.role).map((r) => (
                    <Button
                      key={r.value}
                      variant="outline"
                      size="sm"
                      disabled={updating === user.id}
                      onClick={() => changeRole(user.id, r.value)}
                    >
                      Make {r.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}