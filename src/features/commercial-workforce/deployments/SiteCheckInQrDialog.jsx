import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * Displays a printable QR code for a deployment's site check-in. Workers scan it
 * at the site entrance to clock in/out (opens /checkin/deployment/:id). Ops can
 * print it and put it on the welfare cabin / gate.
 */
export function SiteCheckInQrDialog({ deploymentId, siteName, open, onOpenChange }) {
  const qrRef = useRef(null);
  const url = `${window.location.origin}/checkin/deployment/${deploymentId}`;

  function print() {
    const svg = qrRef.current?.querySelector('svg')?.outerHTML;
    if (!svg) return;
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Site check-in — ${siteName || 'CCG Connect'}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#13161B}
      h1{font-size:20px;margin:0 0 4px}p{color:#555;margin:0 0 24px}
      .qr{display:inline-block;padding:16px;border:1px solid #eee;border-radius:12px}
      .url{margin-top:20px;font-size:12px;color:#888;word-break:break-all}</style></head>
      <body><h1>${siteName || 'Site'} — check in</h1><p>Scan with your phone camera to clock in/out</p>
      <div class="qr">${svg}</div><p class="url">${url}</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode size={18} className="text-[#F97316]" /> Site check-in QR
          </DialogTitle>
          <DialogDescription>
            Print this and display it at the site entrance. Workers scan it with their phone camera to
            clock in and out.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div ref={qrRef} className="rounded-xl border bg-white p-4">
            <QRCodeSVG value={url} size={200} level="M" includeMargin />
          </div>
          {siteName && <p className="text-sm font-medium">{siteName}</p>}
          <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
          <Button onClick={print} className="w-full gap-2">
            <Printer size={16} /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
