import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, CheckCircle, Loader2 } from 'lucide-react';

/**
 * Geolocation check-in button for a job site.
 * On success, records the timestamp + coords and shows a confirmation banner.
 */
export default function JobCheckIn({ job, onCheckedIn }) {
  const [status, setStatus] = useState('idle'); // idle | locating | done | error
  const [coords, setCoords] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  function handleCheckIn() {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      setStatus('error');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ latitude, longitude, accuracy });
        setStatus('done');
        onCheckedIn?.({ latitude, longitude, accuracy, timestamp: new Date().toISOString() });
      },
      (err) => {
        setErrorMsg(err.message || 'Could not get location. Please allow location access.');
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (status === 'done' && coords) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
        <CheckCircle size={15} className="flex-shrink-0" />
        <span>
          Checked in at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{' '}
          <span className="text-green-500 text-xs">({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})</span>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        className="flex items-center gap-2"
        disabled={status === 'locating'}
        onClick={handleCheckIn}
      >
        {status === 'locating' ? (
          <><Loader2 size={14} className="animate-spin" /> Locating…</>
        ) : (
          <><MapPin size={14} /> Check in on-site</>
        )}
      </Button>
      {status === 'error' && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}