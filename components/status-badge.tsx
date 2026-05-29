import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const tone: Record<string, string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  sending: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  sent: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  paused: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  draft: 'border-border bg-muted text-muted-foreground',
  queued: 'border-border bg-muted text-muted-foreground',
  unsubscribed: 'border-border bg-muted text-muted-foreground',
  failed: 'border-red-500/30 bg-red-500/10 text-red-400',
  revoked: 'border-red-500/30 bg-red-500/10 text-red-400',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium capitalize', tone[status])}>
      {status}
    </Badge>
  );
}
