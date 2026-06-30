import { Link } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { profileCompleteness } from '@/domain/profile/completeness';

/** A dismissible-feeling nudge banner; hidden once the core profile is complete. */
export function ProfileCompleteness() {
  const { profile } = useAuth();
  const { percent, missing } = profileCompleteness(profile);
  if (percent >= 100) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Complete your profile</p>
        <span className="text-sm text-muted-foreground">{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      {missing.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Still to add: {missing.join(' · ')}</p>
      )}
      <Link to="/onboarding" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
        Finish setup →
      </Link>
    </div>
  );
}
