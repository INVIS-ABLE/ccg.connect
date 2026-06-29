import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp, signIn } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, ChevronRight, User, Briefcase } from 'lucide-react';

const CCG_LOGO = 'https://cookconstructiongrowth.co.uk/wp-content/uploads/2024/11/CCG-Logo.png';

const TRADE_TYPES = [
  'General building', 'Carpentry & joinery', 'Electrical', 'Plumbing & heating',
  'Plastering', 'Painting & decorating', 'Roofing', 'Groundworks', 'Landscaping',
  'Tiling', 'Flooring', 'Brickwork & masonry', 'Steel fabrication', 'Other',
];

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low — flexible timing' },
  { value: 'medium', label: 'Medium — within a few weeks' },
  { value: 'high', label: 'High — within a week' },
  { value: 'emergency', label: 'Emergency — ASAP' },
];

export default function ClientSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = account, 2 = job, 3 = done
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Step 1 fields
  const [account, setAccount] = useState({ name: '', company: '', email: '', password: '', confirmPassword: '' });

  // Step 2 fields
  const [job, setJob] = useState({
    title: '', trade_category: '', site_postcode: '', site_address: '',
    start_date: '', urgency: 'medium', short_description: '', client_visible_notes: '',
  });

  function setAcc(key, val) { setAccount((a) => ({ ...a, [key]: val })); }
  function setJob2(key, val) { setJob((j) => ({ ...j, [key]: val })); }

  async function onAccountSubmit(e) {
    e.preventDefault();
    if (account.password !== account.confirmPassword) { setError('Passwords do not match.'); return; }
    if (account.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const { error: signUpError } = await signUp.email({
        email: account.email,
        password: account.password,
        name: account.company ? `${account.name} (${account.company})` : account.name,
      });
      if (signUpError) { setError(signUpError.message ?? 'Could not create account.'); return; }
      // Auto sign in after registration
      const { error: signInError } = await signIn.email({ email: account.email, password: account.password });
      if (signInError) { setError('Account created but sign-in failed. Please sign in manually.'); return; }
      setStep(2);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onJobSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { api } = await import('@/api/client');
      await api.jobs.create({ ...job, status: 'enquiry' });
      setStep(3);
    } catch {
      setError('Could not submit your job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: '#0e1117' }}>
      <div className="max-w-xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={CCG_LOGO} alt="CCG" className="h-10 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>

        {/* Step indicator */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-[#F97316] text-white' : 'bg-white/10 text-gray-500'}`}>
                  {s === 1 ? <User size={14} /> : <Briefcase size={14} />}
                </div>
                <span className={`text-xs font-medium ${step >= s ? 'text-white' : 'text-gray-600'}`}>
                  {s === 1 ? 'Your account' : 'Job request'}
                </span>
                {s < 2 && <ChevronRight size={14} className="text-gray-600" />}
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Account ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Create your client account</h1>
              <p className="text-gray-500 text-sm mt-1">Join CCG Connect to submit and track your jobs</p>
            </div>

            <form onSubmit={onAccountSubmit} className="space-y-4">
              <Card className="border-white/10 bg-white/5">
                <CardContent className="pt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Your name *</Label>
                      <Input
                        required
                        value={account.name}
                        onChange={(e) => setAcc('name', e.target.value)}
                        placeholder="Jane Smith"
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Company (optional)</Label>
                      <Input
                        value={account.company}
                        onChange={(e) => setAcc('company', e.target.value)}
                        placeholder="Acme Ltd"
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Email address *</Label>
                    <Input
                      type="email"
                      required
                      value={account.email}
                      onChange={(e) => setAcc('email', e.target.value)}
                      placeholder="you@example.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Password *</Label>
                      <Input
                        type="password"
                        required
                        minLength={8}
                        value={account.password}
                        onChange={(e) => setAcc('password', e.target.value)}
                        placeholder="Min 8 characters"
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Confirm password *</Label>
                      <Input
                        type="password"
                        required
                        value={account.confirmPassword}
                        onChange={(e) => setAcc('confirmPassword', e.target.value)}
                        placeholder="Repeat password"
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {error && <p className="text-sm text-red-400 text-center">{error}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold h-11"
              >
                {submitting ? 'Creating account…' : 'Create account & continue →'}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-[#F97316] hover:underline">Sign in</Link>
            </p>
          </div>
        )}

        {/* ── STEP 2: Job request ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Tell us about your job</h1>
              <p className="text-gray-500 text-sm mt-1">We'll review it and be in touch to arrange a quote</p>
            </div>

            <form onSubmit={onJobSubmit} className="space-y-4">
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Job details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Job title *</Label>
                    <Input
                      required
                      value={job.title}
                      onChange={(e) => setJob2('title', e.target.value)}
                      placeholder="e.g. New kitchen extension"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Trade type *</Label>
                      <Select required value={job.trade_category} onValueChange={(v) => setJob2('trade_category', v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-[#F97316]">
                          <SelectValue placeholder="Select trade" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRADE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Urgency</Label>
                      <Select value={job.urgency} onValueChange={(v) => setJob2('urgency', v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-[#F97316]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Description</Label>
                    <Textarea
                      rows={4}
                      value={job.short_description}
                      onChange={(e) => setJob2('short_description', e.target.value)}
                      placeholder="Describe the work needed, access issues, materials, etc."
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Site location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Site address</Label>
                    <Input
                      value={job.site_address}
                      onChange={(e) => setJob2('site_address', e.target.value)}
                      placeholder="Full site address"
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Site postcode *</Label>
                      <Input
                        required
                        value={job.site_postcode}
                        onChange={(e) => setJob2('site_postcode', e.target.value)}
                        placeholder="e.g. SW1A 1AA"
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Preferred start date</Label>
                      <Input
                        type="date"
                        value={job.start_date}
                        onChange={(e) => setJob2('start_date', e.target.value)}
                        className="bg-white/5 border-white/10 text-white focus-visible:ring-[#F97316]"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Additional notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    rows={3}
                    value={job.client_visible_notes}
                    onChange={(e) => setJob2('client_visible_notes', e.target.value)}
                    placeholder="Access codes, parking, site contact, anything else we should know…"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                  />
                </CardContent>
              </Card>

              {error && <p className="text-sm text-red-400 text-center">{error}</p>}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10"
                  onClick={() => navigate('/')}
                >
                  Skip for now
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !job.trade_category}
                  className="flex-1 bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold h-11"
                >
                  {submitting ? 'Submitting…' : 'Submit job request →'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 3 && (
          <div className="text-center py-16 space-y-6">
            <div className="flex justify-center">
              <CheckCircle size={64} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">You're all set!</h2>
              <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
                Your account is created and your job request has been submitted. The CCG team will review it and be in touch shortly.
              </p>
            </div>
            <Button
              onClick={() => navigate('/')}
              className="bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold px-8"
            >
              Go to my dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}