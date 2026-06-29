import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authClient } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CCG_LOGO = 'https://cookconstructiongrowth.co.uk/wp-content/uploads/2024/11/CCG-Logo.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(null);
    setSubmitting(true);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? 'Reset failed. The link may have expired.');
      return;
    }
    navigate('/login', { replace: true });
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: '#0e1117' }}>
        <p className="text-red-400 text-sm">Invalid or missing reset token. <Link to="/forgot-password" className="text-[#F97316] underline">Request a new link</Link></p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: '#0e1117' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src={CCG_LOGO} alt="CCG" className="h-10 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>

        <h2 className="text-2xl font-bold text-white mb-1 text-center">Set new password</h2>
        <p className="text-sm text-gray-500 text-center mb-8">Choose a strong password for your account.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-300">New password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
              placeholder="Min 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-gray-300">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
              placeholder="Repeat password"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold" disabled={submitting}>
            {submitting ? 'Saving…' : 'Set password'}
          </Button>
        </form>
      </div>
    </div>
  );
}