import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authClient } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CCG_LOGO = 'https://cookconstructiongrowth.co.uk/wp-content/uploads/2024/11/CCG-Logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await authClient.forgetPassword({ email, redirectTo: '/reset-password' });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? 'Something went wrong. Try again.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: '#0e1117' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src={CCG_LOGO} alt="CCG" className="h-10 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>

        <h2 className="text-2xl font-bold text-white mb-1 text-center">Reset password</h2>
        <p className="text-sm text-gray-500 text-center mb-8">We'll email you a reset link.</p>

        {sent ? (
          <div className="rounded-lg bg-green-900/40 border border-green-700 p-4 text-center">
            <p className="text-green-300 text-sm font-medium">Check your inbox</p>
            <p className="text-gray-400 text-xs mt-1">A reset link has been sent to <span className="text-white">{email}</span></p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to="/login" className="text-[#F97316] hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}