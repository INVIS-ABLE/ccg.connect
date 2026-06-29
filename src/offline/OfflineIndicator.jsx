import { CloudOff, RefreshCw } from 'lucide-react';
import { useOnline, usePendingCount } from './syncQueue';

/** Small status chip: shows "Offline" (with any queued count) when disconnected,
 *  or "Syncing" while the outbox drains. Hidden when online and empty. */
export function OfflineIndicator() {
  const online = useOnline();
  const pending = usePendingCount();
  if (online && pending === 0) return null;

  const label = !online ? (pending > 0 ? `Offline · ${pending} queued` : 'Offline') : `Syncing ${pending}…`;
  return (
    <span
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
        online ? 'bg-blue-50 text-blue-700' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {online ? <RefreshCw size={13} className="animate-spin" /> : <CloudOff size={13} />}
      {label}
    </span>
  );
}
