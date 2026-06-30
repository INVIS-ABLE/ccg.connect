import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Phone, Mail, User, Building2, HardHat } from 'lucide-react';

/** A tel: link with spaces stripped, or null if there's no number. */
function telHref(phone) {
  const p = (phone ?? '').replace(/\s+/g, '');
  return p ? `tel:${p}` : null;
}
function mailHref(email, subject) {
  const e = (email ?? '').trim();
  return e ? `mailto:${e}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}` : null;
}

function ContactRow({ icon, label, sub, phone, email, subject }) {
  const tel = telHref(phone);
  const mail = mailHref(email, subject);
  return (
    <div className="flex items-center gap-3 rounded-md border p-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sub || phone || email || 'No contact details'}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button asChild={!!tel} variant="outline" size="sm" disabled={!tel} className="gap-1.5">
          {tel ? (
            <a href={tel}><Phone size={13} /> Call</a>
          ) : (
            <span><Phone size={13} /> Call</span>
          )}
        </Button>
        <Button asChild={!!mail} variant="outline" size="sm" disabled={!mail} className="gap-1.5">
          {mail ? (
            <a href={mail}><Mail size={13} /> Email</a>
          ) : (
            <span><Mail size={13} /> Email</span>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Job contacts: the client and the assigned contractor(s) with one-tap Call /
 * Email actions (tel:/mailto:). Replaces the previously dead contact buttons.
 * Contractor contact details come from their user profile (admin-readable).
 */
export function JobContactsPanel({ job }) {
  const [client, setClient] = useState(null);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const subject = job?.title ? `Re: ${job.title}` : undefined;

  useEffect(() => {
    let alive = true;
    (async () => {
      // Client (org-level contact details).
      if (job?.client_id) {
        try {
          const r = await api.clients.get(job.client_id);
          if (alive) setClient(r.client);
        } catch {
          /* non-fatal */
        }
      }
      // Assigned contractors → their user profile for phone/email.
      try {
        const a = await api.assignments.list();
        const mine = (a.assignments ?? []).filter(
          (x) => x.job_id === job.id && x.assignment_status === 'active',
        );
        const rows = [];
        for (const asg of mine) {
          const cr = await api.contractors.get(asg.contractor_id).catch(() => null);
          if (!cr?.contractor) continue;
          const prof = await api.profiles.get(cr.contractor.user_id).catch(() => null);
          rows.push({
            id: asg.id,
            name: cr.contractor.trading_name || prof?.profile?.display_name || 'Contractor',
            phone: prof?.profile?.phone,
            email: prof?.profile?.email,
          });
        }
        if (alive) setContractors(rows);
      } catch {
        /* non-fatal */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [job]);

  return (
    <div className="space-y-2">
      <ContactRow
        icon={client?.client_type === 'individual' ? <User size={15} /> : <Building2 size={15} />}
        label={client ? client.individual_or_company_name : 'Client'}
        sub={client?.main_contact_name}
        phone={client?.phone}
        email={client?.email}
        subject={subject}
      />
      {loading && contractors.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">Loading contractor contacts…</p>
      )}
      {!loading && contractors.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">No contractor assigned yet.</p>
      )}
      {contractors.map((c) => (
        <ContactRow
          key={c.id}
          icon={<HardHat size={15} />}
          label={c.name}
          sub="Assigned contractor"
          phone={c.phone}
          email={c.email}
          subject={subject}
        />
      ))}
    </div>
  );
}
