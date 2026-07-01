import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, ChevronRight, FolderKanban, UserRound, KeyRound, X } from 'lucide-react';
import { RateCardsSection } from './RateCardsSection';
import { SurchargesSection } from './SurchargesSection';

const CONTACT_ROLES = ['commercial', 'procurement', 'accounts', 'site', 'other'];

const userLabel = (u) => u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.user_id;

export default function CommercialAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contactForm, setContactForm] = useState({ name: '', role: 'commercial', email: '', phone: '' });
  const [projectName, setProjectName] = useState('');
  const [portalUsers, setPortalUsers] = useState([]);
  const [clientUsers, setClientUsers] = useState([]);
  const [linkUserId, setLinkUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, ct, pr, pu, allUsers] = await Promise.all([
      api.commercial.accounts.get(id).catch(() => null),
      api.commercial.contacts.list(id).catch(() => ({ contacts: [] })),
      api.commercial.projects.list(id).catch(() => ({ projects: [] })),
      api.commercial.accountUsers.list(id).catch(() => ({ users: [] })),
      api.admin.users().catch(() => []),
    ]);
    if (a) setAccount(a.account);
    setContacts(ct.contacts ?? []);
    setProjects(pr.projects ?? []);
    setPortalUsers(pu.users ?? []);
    setClientUsers((Array.isArray(allUsers) ? allUsers : []).filter((u) => u.role === 'client'));
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function addContact(e) {
    e.preventDefault();
    if (!contactForm.name.trim()) return;
    setBusy(true);
    try {
      await api.commercial.contacts.create({ account_id: id, ...contactForm, name: contactForm.name.trim() });
      setContactForm({ name: '', role: 'commercial', email: '', phone: '' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addProject(e) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setBusy(true);
    try {
      const r = await api.commercial.projects.create({ account_id: id, name: projectName.trim() });
      setProjectName('');
      navigate(`/commercial/projects/${r.project.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function linkUser(e) {
    e.preventDefault();
    if (!linkUserId) return;
    setBusy(true);
    try {
      await api.commercial.accountUsers.link(id, linkUserId);
      setLinkUserId('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function unlinkUser(userId) {
    setBusy(true);
    try {
      await api.commercial.accountUsers.unlink(id, userId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!account) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const linkedIds = new Set(portalUsers.map((p) => p.user_id));
  const userById = new Map(clientUsers.map((u) => [u.user_id, u]));
  const linkable = clientUsers.filter((u) => !linkedIds.has(u.user_id));

  const facts = [
    ['Reg. number', account.registration_number],
    ['Payment terms', account.payment_terms],
    ['VAT treatment', account.vat_treatment],
    ['CIS treatment', account.cis_treatment],
    ['Framework', account.framework_agreement],
    ['Insurance', account.insurance_requirements],
    ['Accreditations', account.required_accreditations],
    ['Invoice instructions', account.invoice_instructions],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/commercial')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{account.legal_name}</h1>
          {account.trading_name && <p className="text-xs text-muted-foreground">{account.trading_name}</p>}
        </div>
        <Badge variant="secondary" className="capitalize">{account.status}</Badge>
      </div>

      {facts.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Account details</CardTitle></CardHeader>
          <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k}>
                <span className="text-muted-foreground">{k}: </span>
                <span>{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contacts */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Contacts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {contacts.length === 0 && <p className="text-xs text-muted-foreground">No contacts yet.</p>}
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
              <UserRound size={15} className="text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name} <span className="ml-1 text-xs capitalize text-muted-foreground">· {c.role}</span></p>
                <p className="truncate text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</p>
              </div>
            </div>
          ))}
          <form onSubmit={addContact} className="grid gap-2 sm:grid-cols-5">
            <Input className="sm:col-span-2" placeholder="Name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm capitalize"
              value={contactForm.role}
              onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
            >
              {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Input placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            <Input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
            <div className="sm:col-span-5">
              <Button type="submit" size="sm" disabled={busy} className="gap-1.5"><Plus size={14} /> Add contact</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Projects</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects yet.</p>}
          {projects.map((p) => (
            <Link key={p.id} to={`/commercial/projects/${p.id}`} className="flex items-center gap-2 rounded-md border p-2.5 text-sm hover:bg-muted">
              <FolderKanban size={15} className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <Badge variant="outline" className="capitalize">{p.status}</Badge>
              <ChevronRight size={15} className="text-muted-foreground" />
            </Link>
          ))}
          <form onSubmit={addProject} className="flex gap-2 pt-1">
            <Input placeholder="New project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <Button type="submit" size="sm" disabled={busy} className="gap-1.5 shrink-0"><Plus size={14} /> Add project</Button>
          </form>
        </CardContent>
      </Card>

      {/* Agreed rate cards (internal pay/charge/margin) */}
      <RateCardsSection accountId={id} />

      {/* Dynamic-pricing surcharges */}
      <SurchargesSection accountId={id} />

      {/* Portal access — which client logins may see this account's site work */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><KeyRound size={15} /> Portal access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Client logins linked here can view this account&rsquo;s deployments and invoices in their portal — fill status, dates and
            their own invoices only. No rates, margins or worker details are ever shown.
          </p>
          {portalUsers.length === 0 && <p className="text-xs text-muted-foreground">No client logins have portal access yet.</p>}
          {portalUsers.map((pu) => {
            const u = userById.get(pu.user_id);
            return (
              <div key={pu.id} className="flex items-center gap-3 rounded-md border p-2.5 text-sm">
                <UserRound size={15} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u ? userLabel(u) : pu.user_id}</p>
                  {u?.email && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-red-600" disabled={busy} onClick={() => unlinkUser(pu.user_id)}>
                  <X size={13} /> Revoke
                </Button>
              </div>
            );
          })}
          <form onSubmit={linkUser} className="flex gap-2 pt-1">
            <select
              className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={linkUserId}
              onChange={(e) => setLinkUserId(e.target.value)}
            >
              <option value="">{linkable.length ? 'Select a client login…' : 'No unlinked client logins'}</option>
              {linkable.map((u) => (
                <option key={u.user_id} value={u.user_id}>{userLabel(u)}{u.email ? ` (${u.email})` : ''}</option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={busy || !linkUserId} className="gap-1.5 shrink-0"><Plus size={14} /> Grant access</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
