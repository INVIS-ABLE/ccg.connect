import { Component } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * App-level error boundary. A render error anywhere below this point would
 * otherwise blank the whole screen; instead we show a friendly recovery card and
 * keep the rest of the shell usable. Errors are logged (and routed to an optional
 * reporter) without leaking details to the user.
 *
 * Note: error boundaries only catch errors thrown during render/lifecycle, not
 * in event handlers or async code — those are handled at their call sites.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface for debugging. A reporting adapter (e.g. Sentry) can hook in here
    // later via window.__ccgReportError without taking on a dependency now.
    console.error('[ErrorBoundary]', error, info?.componentStack);
    try {
      window.__ccgReportError?.(error, info);
    } catch {
      /* a broken reporter must never mask the original error */
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            That screen hit an unexpected error. Your data is safe — try again, or head back to the
            dashboard.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={this.reset}>
              Try again
            </Button>
            <Button
              onClick={() => {
                this.reset();
                window.location.assign('/');
              }}
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
