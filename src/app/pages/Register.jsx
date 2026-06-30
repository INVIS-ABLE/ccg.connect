import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Turnstile, turnstileEnabled } from '@/app/auth/Turnstile';

const CCG_LOGO = '/ccg-logo.png';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState('contractor');
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    try {
      const { error: signUpError } = await signUp.email(
        { email, password, name },
        token ? { headers: { 'x-turnstile-token': token } } : undefined,
      );
      setSubmitting(false);
      if (signUpError) {
        const msg = signUpError.message ?? '';
        if (msg.includes('405') || msg.toLowerCase().includes('method not allowed')) {
          setError('The authentication server is not reachable. Make sure the Cloudflare Worker is deployed.');
        } else {
          setError(msg || 'Could not create your account. Try again.');
        }
        return;
      }
      // New accounts complete a role-specific onboarding before entering the app.
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setSubmitting(false);
      const msg = String(err?.message ?? err ?? '');
      if (msg.includes('405') || msg.toLowerCase().includes('method not allowed')) {
        setError('The authentication server is not reachable. Make sure the Cloudflare Worker is deployed.');
      } else {
        setError(msg || 'Could not create your account. Please try again.');
      }
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: '#0e1117' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={CCG_LOGO}
            alt="Cook Construction Growth"
            className="h-10 object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        <h2 className="text-2xl font-bold text-white mb-1 text-center">Create your account</h2>
        <p className="text-sm text-gray-500 text-center mb-8">CCG Connect — job management platform</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">Full name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-gray-300">I am a…</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-9 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#F97316]"
            >
              <option value="contractor">Contractor / Tradesperson</option>
              <option value="client">Client (seeking services)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-gray-300">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
            />
          </div>

          <Turnstile onToken={setToken} />

          {error && (
            <p role="alert" className="text-sm text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold"
            disabled={submitting || (turnstileEnabled && !token)}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-[#F97316] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}