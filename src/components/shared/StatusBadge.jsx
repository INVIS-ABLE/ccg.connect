import { cn } from '@/lib/utils';

export default function StatusBadge({ label, color, className }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', color, className)}>
      {label}
    </span>
  );
}