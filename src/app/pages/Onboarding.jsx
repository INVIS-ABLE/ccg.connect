import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { api } from '@/api/client';
import { useAuth } from '@/app/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HardHat, Building2 } from 'lucide-react';

const CONTACT_METHODS = ['phone', 'email', 'sms', 'whatsapp'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, principal, refresh } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(profile?.profile_photo_url ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function uploadPhoto(file) {
    if (!file || !principal?.userId) return;
    setPhotoBusy(true);
    try {
      const r = await api.profiles.uploadPhoto(principal.userId, file);
      setPhotoUrl(r.profile_photo_url);
    } catch {
      setError('Could not upload that photo (use an image under the size limit).');
    } finally {
      setPhotoBusy(false);
    }
  }

  const [common, setCommon] = useState({
    first_name: '',
    last_name: '',
    email: profile?.email ?? '',
    phone: '',
    preferred_contact_method: 'phone',
    line_1: '',
    line_2: '',
    town_city: '',
    county: '',
    postcode: '',
    terms: false,
  });
  const [contractor, setContractor] = useState({
    trading_name: '',
    primary_trade: '',
    biography: '',
    service_radius_miles: '',
    day_rate: '',
    hourly_rate: '',
  });
  const [client, setClient] = useState({ company_name: '', client_type: 'company' });

  function setC(patch) {
    setCommon((s) => ({ ...s, ...patch }));
  }

  const contactValid =
    common.first_name.trim() && common.phone && common.postcode.trim() && common.line_1.trim() && common.terms;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.onboarding.submit({
        role,
        first_name: common.first_name,
        last_name: common.last_name,
        display_name: [common.first_name, common.last_name].filter(Boolean).join(' ') || undefined,
        email: common.email || undefined,
        phone: common.phone || undefined,
        preferred_contact_method: common.preferred_contact_method,
        terms_accepted: common.terms,
        privacy_accepted: common.terms,
        address: {
          line_1: common.line_1,
          line_2: common.line_2,
          town_city: common.town_city,
          county: common.county,
          postcode: common.postcode,
        },
        contractor: role === 'contractor' ? contractor : undefined,
        client: role === 'client' ? client : undefined,
      });
      await refresh();
      navigate('/', { replace: true });
    } catch {
      setError('Could not save your details. Please check the form and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Welcome to CCG Connect</h1>
        <p className="mt-1 text-sm text-muted-foreground">Let's set up your account — step {step} of 3.</p>
      </div>

      {/* Step 1 — account type */}
      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setRole('contractor');
              setStep(2);
            }}
            className="flex flex-col items-center gap-2 rounded-xl border p-6 text-center hover:border-primary hover:bg-primary/5"
          >
            <HardHat className="h-8 w-8 text-primary" />
            <span className="font-semibold">I'm a contractor</span>
            <span className="text-xs text-muted-foreground">Tradesperson looking for work</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('client');
              setStep(2);
            }}
            className="flex flex-col items-center gap-2 rounded-xl border p-6 text-center hover:border-primary hover:bg-primary/5"
          >
            <Building2 className="h-8 w-8 text-primary" />
            <span className="font-semibold">I'm a client</span>
            <span className="text-xs text-muted-foreground">Looking for work done</span>
          </button>
        </div>
      )}

      {/* Step 2 — common contact */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Your contact details</CardTitle>
            <CardDescription>We'll use these to keep in touch about jobs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 sm:col-span-2">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="h-14 w-14 rounded-full border object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-muted" />
              )}
              <label className="cursor-pointer text-sm">
                <span className="inline-flex items-center rounded-md border px-3 py-1.5 hover:bg-muted">
                  {photoBusy ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    uploadPhoto(f);
                  }}
                />
              </label>
            </div>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input value={common.first_name} onChange={(e) => setC({ first_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input value={common.last_name} onChange={(e) => setC({ last_name: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Mobile number</Label>
              <PhoneInput
                defaultCountry="GB"
                international
                value={common.phone}
                onChange={(v) => setC({ phone: v ?? '' })}
                className="rounded-md border px-3 py-1 [&_input]:bg-transparent [&_input]:outline-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={common.email} onChange={(e) => setC({ email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Preferred contact</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
                value={common.preferred_contact_method}
                onChange={(e) => setC({ preferred_contact_method: e.target.value })}
              >
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address line 1</Label>
              <Input value={common.line_1} onChange={(e) => setC({ line_1: e.target.value })} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address line 2</Label>
              <Input value={common.line_2} onChange={(e) => setC({ line_2: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Town / city</Label>
              <Input value={common.town_city} onChange={(e) => setC({ town_city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>County</Label>
              <Input value={common.county} onChange={(e) => setC({ county: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input value={common.postcode} onChange={(e) => setC({ postcode: e.target.value })} required />
            </div>
            <label className="flex items-start gap-2 sm:col-span-2 text-sm">
              <input type="checkbox" className="mt-1" checked={common.terms} onChange={(e) => setC({ terms: e.target.checked })} />
              <span>I agree to the terms of service and privacy policy.</span>
            </label>
            <div className="flex justify-between sm:col-span-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={!contactValid} onClick={() => setStep(3)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — role details */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{role === 'contractor' ? 'About your business' : 'About your project'}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {role === 'contractor' ? (
              <>
                <div className="space-y-2">
                  <Label>Trading name</Label>
                  <Input value={contractor.trading_name} onChange={(e) => setContractor({ ...contractor, trading_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Primary trade</Label>
                  <Input value={contractor.primary_trade} onChange={(e) => setContractor({ ...contractor, primary_trade: e.target.value })} placeholder="e.g. Electrician" />
                </div>
                <div className="space-y-2">
                  <Label>Short bio</Label>
                  <Input value={contractor.biography} onChange={(e) => setContractor({ ...contractor, biography: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Radius (mi)</Label>
                    <Input type="number" min="0" value={contractor.service_radius_miles} onChange={(e) => setContractor({ ...contractor, service_radius_miles: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Day rate £</Label>
                    <Input type="number" min="0" value={contractor.day_rate} onChange={(e) => setContractor({ ...contractor, day_rate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly £</Label>
                    <Input type="number" min="0" value={contractor.hourly_rate} onChange={(e) => setContractor({ ...contractor, hourly_rate: e.target.value })} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Company / your name</Label>
                  <Input value={client.company_name} onChange={(e) => setClient({ ...client, company_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Client type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
                    value={client.client_type}
                    onChange={(e) => setClient({ ...client, client_type: e.target.value })}
                  >
                    {['individual', 'company', 'housing_association', 'local_authority', 'other'].map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>Back</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Finish setup'}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
