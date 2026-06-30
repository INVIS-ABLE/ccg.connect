import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, X, Share } from 'lucide-react';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

/**
 * In-app PWA affordances:
 *  - an "Install app" prompt (Chromium beforeinstallprompt, or an iOS hint),
 *  - an "update available" toast when a new service worker is waiting.
 * Rendered once near the app root; self-contained so it has no external deps
 * beyond the SW registration hook.
 */
export function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const [installEvent, setInstallEvent] = useState(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed — nothing to offer
    const onPrompt = (e) => {
      e.preventDefault(); // stash it; we trigger it from our own button
      setInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    // iOS Safari never fires beforeinstallprompt — offer the manual hint instead.
    if (isIos()) setIosHint(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    try {
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
    }
  }

  // Update toast takes priority over the install nudge.
  if (needRefresh) {
    return (
      <Banner
        icon={<RefreshCw size={16} />}
        title="Update available"
        body="A new version of CCG Connect is ready."
        action={
          <Button size="sm" onClick={() => updateServiceWorker(true)} className="gap-1.5">
            <RefreshCw size={14} /> Reload
          </Button>
        }
        onClose={() => setNeedRefresh(false)}
      />
    );
  }

  if (dismissed) return null;

  if (installEvent) {
    return (
      <Banner
        icon={<Download size={16} />}
        title="Install CCG Connect"
        body="Add it to your device for a full-screen, offline-ready app."
        action={
          <Button size="sm" onClick={install} className="gap-1.5">
            <Download size={14} /> Install
          </Button>
        }
        onClose={() => setDismissed(true)}
      />
    );
  }

  if (iosHint) {
    return (
      <Banner
        icon={<Share size={16} />}
        title="Install CCG Connect"
        body={
          <>
            Tap <Share size={12} className="mx-0.5 inline align-text-bottom" /> Share, then <strong>Add to Home Screen</strong>.
          </>
        }
        onClose={() => setDismissed(true)}
      />
    );
  }

  return null;
}

function Banner({ icon, title, body, action, onClose }) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{body}</p>
        </div>
        {action}
        <button onClick={onClose} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
