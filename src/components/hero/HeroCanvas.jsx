import { Component, Suspense, lazy } from 'react';

// The 3D scene pulls in three.js + R3F; load it lazily so it never blocks the
// initial app shell / sign-in, and code-splits out of the main bundle.
const HeroScene = lazy(() => import('./HeroScene'));

/**
 * Static dark backdrop shown while the scene loads, on reduced-motion
 * preference fallbacks, or if WebGL is unavailable. Mirrors the scene's
 * background (#08090b) with a warm brand glow so the swap is seamless.
 */
function HeroFallback() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(120% 90% at 70% 25%, rgba(255,122,24,0.18), transparent 55%), #08090b',
      }}
    />
  );
}

/**
 * Guards against WebGL/context-creation failures (older devices, blocked GPU).
 * On error we fall back to the static backdrop — the landing copy stays usable.
 */
class HeroErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <HeroFallback />;
    return this.props.children;
  }
}

export default function HeroCanvas() {
  return (
    <div className="absolute inset-0">
      <HeroErrorBoundary>
        <Suspense fallback={<HeroFallback />}>
          <HeroScene />
        </Suspense>
      </HeroErrorBoundary>
    </div>
  );
}
