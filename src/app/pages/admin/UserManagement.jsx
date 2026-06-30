import { useEffect, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useAuth } from '@/app/auth/AuthProvider';
import { isOwnerRole } from '@/domain/auth/roles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, User, AlertTriangle, UserPlus } from 'lucide-react';
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
    api.admin
      .users()
      .then((rows) => setUsers(rows))
      .catch(() =>
        toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' }),
      )
      .finally(() => setLoading(false));
  }, [toast]);

  async function changeRole(userId, newRole) {
    setUpdating(userId);
    setConfirmGrant(null);
    try {
      const updated = await api.admin.setRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      toast({ title: 'Role updated', description: `User is now ${roleMeta(newRole).label}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  }

  function onStaffCreated(profile) {
    setUsers((prev) => (prev ? [...prev, profile] : [profile]));
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

      {/* Add staff member — admin-only creation of a new login for Lee + staff */}
      <AddStaffForm isOwner={isOwner} onCreated={onStaffCreated} />

      {loading && <p className="text-muted-foreground text-sm">Loading users…</p>}
      {!loading && users?.length === 0 && <p className="text-muted-foreground text-sm">No users found yet.</p>}

      <div className="grid gap-4">
        {users?.map((user) => {
          const meta = roleMeta(user.role);
          const displayName = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed user';
          const isSelf = user.user_id === principal?.userId;
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

/**
 * Admin-only form to create a new staff login (Lee + any team members he gives
 * accounts to). This is the privileged counterpart to public onboarding, which
 * deliberately refuses owner/ops_admin roles — staff accounts can only be minted
 * here by an existing admin. Owner role is owner-only to create.
 */
function AddStaffForm({ isOwner, onCreated }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'ops_admin',
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function reset() {
    setForm({ first_name: '', last_name: '', email: '', password: '', role: 'ops_admin' });
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.email.trim() || form.password.length < 8) {
      toast({
        title: 'Check the form',
        description: 'A valid email and a password of at least 8 characters are required.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const profile = await api.admin.createStaff({
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        role: form.role,
      });
      onCreated(profile);
      toast({
        title: 'Staff login created',
        description: `${profile.display_name || profile.email} can now sign in.`,
      });
      reset();
      setOpen(false);
    } catch (err) {
      const code = err instanceof ApiError ? err.body?.error : null;
      const messages = {
        profile_exists: 'An account already exists for that email.',
        weak_password: 'Password must be at least 8 characters.',
        invalid_email: 'That email address is not valid.',
        only_owner_can_create_owner: 'Only the Owner can create another Owner.',
        Forbidden: 'You do not have permission to create staff.',
      };
      toast({
        title: 'Could not create staff login',
        description: (code && messages[code]) || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="flex items-center gap-2" onClick={() => setOpen(true)}>
        <UserPlus size={16} /> Add staff member
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <UserPlus size={16} className="text-primary" /> Add staff member
        </h2>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="staff-first">First name</Label>
            <Input
              id="staff-first"
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="staff-last">Last name</Label>
            <Input
              id="staff-last"
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="staff-password">Temporary password</Label>
            <Input
              id="staff-password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters. Share it securely; they can change it after signing in.
            </p>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="staff-role">Role</Label>
            <select
              id="staff-role"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ops_admin">Operations Admin</option>
              {isOwner && <option value="owner">Owner</option>}
            </select>
            <p className="text-xs text-muted-foreground">
              Operations Admins manage day-to-day work. {isOwner ? 'Owner has full control including user management.' : 'Only the Owner can create another Owner.'}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create login'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}