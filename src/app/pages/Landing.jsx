import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronUp } from 'lucide-react';
import HeroCanvas from '@/components/hero/HeroCanvas';
import { Turnstile, turnstileEnabled } from '@/app/auth/Turnstile';

// Served from public/ — the Cook Construction Growth brand logo. (The old
// wp-content URL 404s now that the marketing site moved it.)
const CCG_LOGO = '/ccg-logo.png';

/**
 * The app's "front door": the CCG website hero — including its animated 3D
 * growth scene — sits as the face of the app, minus the marketing nav (just the
 * logo, top-left). Swiping / scrolling up snaps to the sign-in panel.
 */
export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const loginRef = useRef(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await signIn.email(
        { email, password },
        token ? { headers: { 'x-turnstile-token': token } } : undefined,
      );
      setSubmitting(false);
      if (signInError) {
        const msg = signInError.message ?? '';
        if (msg.toLowerCase().includes('method not allowed') || msg.includes('405')) {
          setError('The authentication server is not reachable. Make sure the Cloudflare Worker is deployed and running.');
        } else {
          setError(msg || 'Sign in failed. Check your details and try again.');
        }
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitting(false);
      const msg = String(err?.message ?? err ?? '');
      if (msg.includes('405') || msg.toLowerCase().includes('method not allowed')) {
        setError('The authentication server is not reachable. Make sure the Cloudflare Worker is deployed and running.');
      } else {
        setError(msg || 'Sign in failed. Please try again.');
      }
    }
  }

  function scrollToLogin() {
    loginRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div
      className="h-screen overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollSnapType: 'y mandatory', background: '#08090b' }}
    >
      {/* ── PANEL 1: Hero (animated 3D growth scene behind the copy) ── */}
      <section className="snap-start relative flex flex-col justify-between min-h-screen w-full overflow-hidden">
        {/* Animated 3D brand hero, ported from the CCG website. */}
        <HeroCanvas />

        {/* Overlays: darken the bottom so the copy + CTA stay legible over the scene. */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(8,9,11,0.15) 0%, rgba(8,9,11,0) 35%, rgba(8,9,11,0.85) 100%)',
          }}
        />

        {/* Logo (top-left) — no marketing nav. On a white chip so the dark-navy
            brand logo stays legible over the dark 3D scene. */}
        <header className="relative z-10 flex items-center px-6 pt-12 pb-4">
          <span className="inline-flex rounded-xl bg-white/90 px-3 py-2 shadow-lg ring-1 ring-black/5">
            <img
              src={CCG_LOGO}
              alt="Cook Construction Growth"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </span>
        </header>

        {/* Hero copy — sits in a lightly tinted panel so the 3D scene shows
            through it while the text stays readable. */}
        <main className="relative z-10 flex-1 flex flex-col justify-end px-6 pb-8">
          <div
            className="max-w-md rounded-2xl bg-black/30 p-6 ring-1 ring-white/10 backdrop-blur-[2px] [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]"
          >
            <p className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#F97316] mb-5">
              <span className="inline-block w-6 h-px bg-[#F97316]" />
              Growth partner for the construction industry
            </p>

            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight text-white mb-4">
              We do the <span className="text-[#F97316]">heavy lifting</span> so your business can build.
            </h1>

            <p className="text-sm text-gray-300 leading-relaxed">
              Cook Construction Growth pairs trades and construction businesses with quality jobs
              and projects — and connects clients with vetted, reliable contractors who hold a
              real standard of work.
            </p>
          </div>
        </main>

        {/* Swipe-up prompt → sign-in panel. */}
        <button
          type="button"
          onClick={scrollToLogin}
          className="relative z-10 flex flex-col items-center gap-1 pb-10 w-full text-gray-300 hover:text-white transition-colors"
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
          {/* Mini logo — white chip keeps the dark-navy logo legible on the
              dark login panel. */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex rounded-xl bg-white/90 px-3 py-2 shadow-lg ring-1 ring-black/5">
              <img
                src={CCG_LOGO}
                alt="Cook Construction Growth"
                className="h-9 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </span>
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

            <Turnstile onToken={setToken} />

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-[#F97316] hover:bg-[#ea6c0a] text-white font-semibold"
              disabled={submitting || (turnstileEnabled && !token)}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* Clear sign-up call to action for new contractors/staff. */}
          <div className="mt-6 flex items-center gap-3 text-xs text-gray-600">
            <span className="h-px flex-1 bg-white/10" />
            New here?
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <Button
            type="button"
            onClick={() => navigate('/register')}
            className="mt-4 w-full bg-transparent border border-[#F97316]/50 text-[#F97316] hover:bg-[#F97316]/10 font-semibold"
          >
            Create an account
          </Button>
          <p className="mt-2 text-center text-xs text-gray-600">For contractors &amp; staff</p>

          <p className="mt-5 text-center text-sm text-gray-500">
            <Link to="/forgot-password" className="text-[#F97316] hover:underline">
              Forgot your password?
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-gray-500">
            New client?{' '}
            <Link to="/client-signup" className="font-medium text-[#F97316] hover:underline">
              Request a quote
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}