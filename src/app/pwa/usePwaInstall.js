import { useEffect, useState } from 'react';

/**
 * Shared PWA install state.
 *
 * `beforeinstallprompt` fires once, early, and only on Chromium browsers — often
 * before any individual React component has mounted. We capture it at module
 * load on a shared variable so *every* consumer (the root install banner and the
 * explicit "Install app" button on the login page) sees the same deferred prompt
 * regardless of mount order. Subscribers are notified when it arrives or when the
 * app is installed.
 */

let deferredPrompt = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stash it; we trigger it later from our own UI rather than the browser's
    // default mini-infobar.
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export const isIos = () => {
  if (typeof navigator === 'undefined') return false;
  // iPadOS 13+ reports as "MacIntel" but is a touch device — catch it too.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

export const isIpad = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /ipad/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/**
 * Which browser the iOS user is in. "Add to Home Screen" only works in Safari,
 * so we must steer users out of Chrome/Firefox/Edge for iOS and (especially)
 * the in-app webviews used by Instagram/Facebook/etc. Returns one of:
 * 'safari' | 'chrome' | 'firefox' | 'edge' | 'opera' | 'inapp' | null(non-iOS).
 */
export const getIosBrowser = () => {
  if (!isIos()) return null;
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'chrome';
  if (/FxiOS/i.test(ua)) return 'firefox';
  if (/EdgiOS/i.test(ua)) return 'edge';
  if (/OPiOS|OPT\//i.test(ua)) return 'opera';
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|WhatsApp|Snapchat|Pinterest|MicroMessenger/i.test(ua))
    return 'inapp';
  // Real Safari carries both the "Safari" and "Version/" tokens; bare WKWebView
  // (in-app) usually lacks "Safari".
  if (/Safari/i.test(ua) && /Version\//i.test(ua)) return 'safari';
  return 'inapp';
};

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true);

/**
 * Hook exposing the current install affordance:
 *  - `canInstall`   — a native install prompt is available (Chromium/Android/desktop)
 *  - `isIosDevice`  — iOS Safari, which needs the manual "Add to Home Screen" hint
 *  - `isInstalled`  — already running as an installed/standalone app
 *  - `promptInstall`— trigger the native prompt; resolves to the user's choice
 */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(Boolean(deferredPrompt));
  const [isInstalled, setIsInstalled] = useState(isStandalone());

  useEffect(() => {
    const sync = () => {
      setCanInstall(Boolean(deferredPrompt));
      setIsInstalled(isStandalone());
    };
    subscribers.add(sync);
    sync();
    return () => {
      subscribers.delete(sync);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return null;
    const event = deferredPrompt;
    event.prompt();
    try {
      const choice = await event.userChoice;
      return choice?.outcome ?? null;
    } finally {
      // A deferred prompt can only be used once.
      deferredPrompt = null;
      notify();
    }
  }

  return { canInstall, isIosDevice: isIos(), isInstalled, promptInstall };
}
