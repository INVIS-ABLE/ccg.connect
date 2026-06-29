import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronUp } from 'lucide-react';

/**
 * Full-page landing that mirrors the CCG website hero.
 * Swipe / scroll up reveals the sign-in form on the second "snap" panel.
 */
export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const loginRef = useRef(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? 'Sign in failed. Check your details and try again.');
      return;
    }
    navigate('/', { replace: true });
  }

  function scrollToLogin() {
    loginRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div
      className="h-screen overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {/* ── PANEL 1: Hero ── */}
      <section
        className="snap-start relative flex flex-col justify-between min-h-screen w-full overflow-hidden"
        style={{ background: '#0e1117' }}
      >
        {/* Subtle grid texture overlay */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo */}
        <header className="relative z-10 flex items-center px-6 pt-12 pb-4">
          <img
            src="https://cookconstructiongrowth.co.uk/wp-content/uploads/2024/11/CCG-Logo.png"
            alt="Cook Construction Growth"
            className="h-12 object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </header>

        {/* Hero copy */}
        <main className="relative z-10 flex-1 flex flex-col justify-center px-6 pb-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#F97316] mb-6">
            <span className="inline-block w-6 h-px bg-[#F97316]" />
            Growth partner for the construction industry
          </p>

          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-white mb-6">
            We do the{' '}
            <span className="text-[#F97316]">heavy lifting</span>{' '}
            so your business can build.
          </h1>

          <p className="text-sm sm:text-base text-gray-400 max-w-md leading-relaxed">
            Cook Construction Growth pairs trades and construction businesses with quality jobs
            and projects — and connects clients with vetted, reliable contractors who hold a
            real standard of work.
          </p>
        </main>

        {/* Swipe-up prompt */}
        <button
          onClick={scrollToLogin}
          className="relative z-10 flex flex-col items-center gap-1 pb-10 w-full text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-xs font-medium tracking-wide uppercase">Sign in to your portal</span>
          <ChevronUp
            className="animate-bounce text-[#F97316]"
            size={28}
            style={{ animationDuration: '1.4s' }}
          />
        </button>
      </section>

      {/* ── PANEL 2: Login ── */}
      <section
        ref={loginRef}
        className="snap-start flex flex-col items-center justify-center min-h-screen w-full px-4"
        style={{ background: '#0e1117' }}
      >
        <div className="w-full max-w-sm">
          {/* Mini logo */}
          <div className="flex justify-center mb-8">
            <img
              src="https://cookconstructiongrowth.co.uk/wp-content/uploads/2024/11/CCG-Logo.png"
              alt="Cook Construction Growth"
              className="h-10 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          <h2 className="text-2xl font-bold text-white mb-1 text-center">Portal Login</h2>
          <p className="text-sm text-gray-500 text-center mb-8">CCG Connect — job management platform</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#F97316]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            No account?{' '}
            <Link to="/register" className="font-medium text-[#F97316] hover:underline">
              Register
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}