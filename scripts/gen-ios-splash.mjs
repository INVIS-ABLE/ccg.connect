// Generates iOS "apple-touch-startup-image" launch screens: the branded app
// icon (public/pwa-512.png) centred on the dark brand background, one PNG per
// common iPhone/iPad device resolution. Output → public/splash/*.png, and the
// matching <link> tags are printed for index.html.
//
// Usage:  CHROME=/path/to/chrome node scripts/gen-ios-splash.mjs
// Requires a headless Chromium/Chrome binary (set CHROME, or it tries the
// Playwright-managed one). Re-run if the icon or device list changes.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'splash');
const TMP = process.env.TMPDIR ?? '/tmp';
const BG = '#13161B';
const CHROME =
  process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

mkdirSync(OUT, { recursive: true });
const iconUri = `data:image/png;base64,${readFileSync(join(ROOT, 'public', 'pwa-512.png')).toString('base64')}`;

// [name, cssWidth, cssHeight, devicePixelRatio] in portrait.
const devices = [
  ['iphone-se', 375, 667, 2],
  ['iphone-xr-11', 414, 896, 2],
  ['iphone-x-xs-11pro', 375, 812, 3],
  ['iphone-12-13-mini', 360, 780, 3],
  ['iphone-12-13-14', 390, 844, 3],
  ['iphone-14pro-15-16', 393, 852, 3],
  ['iphone-12-13-promax', 428, 926, 3],
  ['iphone-plus-promax', 430, 932, 3],
  ['ipad-9_7', 768, 1024, 2],
  ['ipad-air', 820, 1180, 2],
  ['ipad-pro-11', 834, 1194, 2],
  ['ipad-pro-12_9', 1024, 1366, 2],
];

const links = [];
for (const [name, cssW, cssH, dpr] of devices) {
  const w = cssW * dpr;
  const h = cssH * dpr;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${w}px;height:${h}px;background:${BG};
      display:flex;align-items:center;justify-content:center;overflow:hidden}
    img{width:${Math.round(Math.min(w, h) * 0.34)}px;height:auto}
  </style></head><body><img src="${iconUri}"></body></html>`;
  const htmlPath = join(TMP, `splash-${name}.html`);
  writeFileSync(htmlPath, html);
  execFileSync(
    CHROME,
    [
      '--headless', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1', `--window-size=${w},${h}`,
      `--screenshot=${join(OUT, `${name}.png`)}`,
      '--virtual-time-budget=1500', `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  );
  links.push(
    `    <link rel="apple-touch-startup-image" media="screen and (device-width: ${cssW}px) and (device-height: ${cssH}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="/splash/${name}.png" />`,
  );
  console.log(`generated splash/${name}.png (${w}x${h})`);
}

console.log('\n<link> tags for index.html:\n' + links.join('\n'));
