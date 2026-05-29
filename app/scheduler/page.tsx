import { getDb } from '@/db/index';
import { getSchedulerConfig, schedulerOpenNow } from '@/lib/scheduler-config';
import { SchedulerForm } from './SchedulerForm';

export const dynamic = 'force-dynamic';

export default async function SchedulerPage() {
  const cfg = await getSchedulerConfig(getDb());
  const open = schedulerOpenNow(cfg);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Send scheduler</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One global policy paces the whole sending stream. The per-inbox daily ceiling
            (<code className="rounded bg-muted px-1">DAILY_LIMIT_PER_ACCOUNT</code>) is a separate cap underneath.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            open
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-border bg-muted text-muted-foreground'
          }`}
        >
          <span className={`size-1.5 rounded-full ${open ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
          {open ? 'Sending open' : 'Not sending'}
        </div>
      </div>

      <SchedulerForm
        initial={{
          enabled: cfg.enabled,
          hourlyMax: cfg.hourlyMax,
          dailyMax: cfg.dailyMax,
          minIntervalSeconds: cfg.minIntervalSeconds,
          maxIntervalSeconds: cfg.maxIntervalSeconds,
          windowStart: cfg.windowStart,
          windowEnd: cfg.windowEnd,
          timezone: cfg.timezone,
        }}
      />
    </div>
  );
}
