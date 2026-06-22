import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'text-primary', trend }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10', )}>
            <Icon className={cn('w-4 h-4', color)} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}