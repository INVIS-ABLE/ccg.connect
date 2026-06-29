import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allCredentials = await base44.asServiceRole.entities.Credential.list();
    const today = new Date();
    const in30 = new Date();
    in30.setDate(today.getDate() + 30);

    const expiring = allCredentials.filter((c) => {
      if (!c.expiry_date) return false;
      const exp = new Date(c.expiry_date);
      return exp >= today && exp <= in30;
    });

    if (expiring.length === 0) {
      return Response.json({ message: 'No credentials expiring in the next 30 days.' });
    }

    // Group by contractor
    const byContractor = {};
    for (const c of expiring) {
      const key = c.contractor_id || c.created_by_id || 'unknown';
      if (!byContractor[key]) byContractor[key] = [];
      byContractor[key].push(c);
    }

    const alerts = [];

    for (const [contractorId, creds] of Object.entries(byContractor)) {
      const list = creds
        .map((c) => `• ${c.credential_type || c.credential_type_id || 'Document'} — expires ${c.expiry_date}`)
        .join('\n');

      // Notify admin
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `⚠️ CCG Connect: ${creds.length} contractor credential(s) expiring within 30 days`,
        body: `The following credentials are expiring soon:\n\n${list}\n\nContractor ID: ${contractorId}\n\nPlease review compliance at your earliest convenience.`,
      });

      // Attempt to notify the contractor if we can find their user record
      try {
        const users = await base44.asServiceRole.entities.User.filter({ id: contractorId });
        if (users.length > 0 && users[0].email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: users[0].email,
            subject: '⚠️ CCG Connect: Your credentials are expiring soon',
            body: `Hi ${users[0].full_name || 'there'},\n\nThe following of your credentials are due to expire within 30 days:\n\n${list}\n\nPlease upload renewed documents as soon as possible to remain compliant.\n\nCook Construction Growth`,
          });
        }
      } catch {
        // Contractor user lookup is best-effort
      }

      alerts.push({ contractorId, count: creds.length });
    }

    return Response.json({ processed: alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});