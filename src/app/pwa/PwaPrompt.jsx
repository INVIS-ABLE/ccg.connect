import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, X, Share } from 'lucide-react';
import { usePwaInstall } from '@/app/pwa/usePwaInstall';

/**
 * In-app PWA affordances:
 *  - an "Install app" prompt (Chromium beforeinstallprompt, or an iOS hint),
 *  - an "update available" toast when a new service worker is waiting.
 * Rendered once near the app root. Install state comes from the shared
 * `usePwaInstall` hook so this banner and the explicit "Install app" button on
 * the login page stay in sync.
 */
export function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const { canInstall, isIosDevice, isInstalled, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

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

  if (dismissed || isInstalled) return null;

  if (canInstall) {
    return (
      <Banner
        icon={<Download size={16} />}
        title="Install CCG Connect"
        body="Add it to your device for a full-screen, offline-ready app."
        action={
          <Button size="sm" onClick={promptInstall} className="gap-1.5">
            <Download size={14} /> Install
          </Button>
        }
        onClose={() => setDismissed(true)}
      />
    );
  }

  if (isIosDevice) {
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
