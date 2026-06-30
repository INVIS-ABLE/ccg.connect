import { useEffect, useState } from 'react';
import { Download, Share, Check, Smartphone, MoreVertical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePwaInstall } from '@/app/pwa/usePwaInstall';

const isAndroid = () =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

/**
 * Explicit "Install app" affordance for the login page. Unlike the root banner
 * (which the user can dismiss), this is always available so anyone can add CCG
 * Connect to their device on demand — and the marketing site deep-links here
 * with `?install=1` to open the dialog automatically.
 *
 * The dialog adapts to what the current browser actually supports:
 *  - A native one-tap install button whenever the browser offers it (Chromium
 *    desktop + Android Chrome/Edge). We give Chrome a short grace period after
 *    the dialog opens, because `beforeinstallprompt` often fires a beat after
 *    load — so the one-tap button appears instead of the manual fallback.
 *  - Android without the prompt (already added, or prompt withheld): the exact
 *    Chrome menu path, which still creates a real installed app (WebAPK).
 *  - iOS Safari: step-by-step "Add to Home Screen" (iOS never allows one-tap).
 *  - Anything else: generic browser-menu guidance.
 */
export function InstallAppButton({ autoOpen = false, className }) {
  const { canInstall, isIosDevice, isInstalled, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  // Wait briefly for Chrome to surface the native prompt before falling back to
  // manual steps, so a slightly-delayed prompt still shows the one-tap button.
  const [waitedForPrompt, setWaitedForPrompt] = useState(false);

  useEffect(() => {
    if (autoOpen && !isInstalled) setOpen(true);
  }, [autoOpen, isInstalled]);

  useEffect(() => {
    if (!open) {
      setWaitedForPrompt(false);
      return;
    }
    if (canInstall) return; // prompt already available — no need to wait
    const t = setTimeout(() => setWaitedForPrompt(true), 1500);
    return () => clearTimeout(t);
  }, [open, canInstall]);

  // Already running as an installed app — surface a quiet confirmation only.
  if (isInstalled) {
    return (
      <p className={`flex items-center justify-center gap-1.5 text-xs text-gray-500 ${className ?? ''}`}>
        <Check size={14} className="text-[#F97316]" /> You&apos;re using the installed app
      </p>
    );
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`w-full gap-2 border-white/15 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white ${className ?? ''}`}
      >
        <Smartphone size={16} /> Download the app
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download size={18} className="text-[#F97316]" /> Install CCG Connect
            </DialogTitle>
            <DialogDescription>
              Add CCG Connect to your device for a full-screen, offline-ready app that
              opens straight from your home screen.
            </DialogDescription>
          </DialogHeader>

          {canInstall ? (
            <div className="space-y-4">
              <Button onClick={handleInstall} className="w-full gap-2 bg-[#F97316] text-white hover:bg-[#ea6c0a]">
                <Download size={16} /> Install app
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                You can keep using the portal in your browser instead — just close this and sign in.
              </p>
            </div>
          ) : isIosDevice ? (
            <IosSteps />
          ) : !waitedForPrompt && isAndroid() ? (
            <Waiting />
          ) : isAndroid() ? (
            <AndroidSteps />
          ) : (
            <GenericSteps />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Waiting() {
  return (
    <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
      <Loader2 size={16} className="animate-spin text-[#F97316]" /> Preparing the install option…
    </p>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F97316]/15 text-xs font-semibold text-[#F97316]">
        {n}
      </span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  );
}

function AndroidSteps() {
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        <Step n={1}>
          Tap the <MoreVertical size={13} className="mx-0.5 inline align-text-bottom" /> menu
          (top-right of Chrome).
        </Step>
        <Step n={2}>
          Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
        </Step>
        <Step n={3}>
          Tap <strong>Install</strong> — CCG Connect is added as a real app with its own icon.
        </Step>
      </ol>
      <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
        No install option in the menu? It&apos;s already installed — look for the CCG Connect
        icon in your app drawer or home screen.
      </p>
    </div>
  );
}

function IosSteps() {
  return (
    <ol className="space-y-3">
      <Step n={1}>
        Tap the <Share size={13} className="mx-0.5 inline align-text-bottom" /> <strong>Share</strong> button
        in Safari&apos;s toolbar.
      </Step>
      <Step n={2}>
        Scroll down and choose <strong>Add to Home Screen</strong>.
      </Step>
      <Step n={3}>
        Tap <strong>Add</strong> — CCG Connect now lives on your home screen like any other app.
      </Step>
    </ol>
  );
}

function GenericSteps() {
  return (
    <ol className="space-y-3">
      <Step n={1}>
        Open your browser&apos;s menu (the <strong>⋮</strong> or <strong>⋯</strong> icon).
      </Step>
      <Step n={2}>
        Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
      </Step>
      <Step n={3}>
        Confirm — CCG Connect opens in its own window from now on.
      </Step>
    </ol>
  );
}
