import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled/service calls without user auth
    const allCredentials = await base44.asServiceRole.entities.ContractorCredential.filter({ archived: false });
    const allProfiles = await base44.asServiceRole.entities.ContractorProfile.list();
    const allUsers = await base44.asServiceRole.entities.User.list();
    const allCredTypes = await base44.asServiceRole.entities.CredentialType.list();

    const today = new Date();
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const todayStr = today.toISOString().split('T')[0];
    const in30Str = in30.toISOString().split('T')[0];

    const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p]));
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));
    const credTypeMap = Object.fromEntries(allCredTypes.map(ct => [ct.id, ct]));

    // Find credentials expiring within 30 days that haven't had a 30-day reminder sent
    const expiring = allCredentials.filter(c => {
      if (!c.expiry_date) return false;
      if (c.verification_status === 'expired') return false;
      if (c.reminder_30_sent) return false;
      return c.expiry_date >= todayStr && c.expiry_date <= in30Str;
    });

    let emailsSent = 0;

    for (const cred of expiring) {
      const profile = profileMap[cred.contractor_id];
      if (!profile) continue;

      const user = userMap[profile.user_id];
      const credType = credTypeMap[cred.credential_type_id];
      const contractorName = profile.trading_name || profile.legal_name || user?.full_name || 'Unknown Contractor';
      const credName = credType?.name || 'Document';
      const daysLeft = Math.ceil((new Date(cred.expiry_date) - today) / 86400000);

      // Find admin/owner emails to notify
      const adminUsers = allUsers.filter(u => ['admin', 'owner', 'ops_admin'].includes(u.role));

      for (const admin of adminUsers) {
        if (!admin.email) continue;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `⚠️ Credential Expiring in ${daysLeft} Days — ${contractorName}`,
          body: `
Hi ${admin.full_name || 'there'},

This is an automated alert from CCG Connect.

A contractor document is expiring soon and requires your attention:

  Contractor: ${contractorName}
  Document:   ${credName}
  Expiry Date: ${cred.expiry_date}
  Days Remaining: ${daysLeft}
  ${cred.registration_or_policy_number ? `Reference: ${cred.registration_or_policy_number}` : ''}
  ${cred.issuer ? `Issuer: ${cred.issuer}` : ''}

Please log in to CCG Connect to review and chase the updated document before it expires.

Go to: Compliance → Credentials

This alert will not be repeated for this document.

— CCG Connect Automated Alerts
          `.trim(),
        });
      }

      // Mark reminder sent
      await base44.asServiceRole.entities.ContractorCredential.update(cred.id, { reminder_30_sent: true });
      emailsSent++;
    }

    return Response.json({ checked: allCredentials.length, expiring: expiring.length, emails_sent: emailsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});