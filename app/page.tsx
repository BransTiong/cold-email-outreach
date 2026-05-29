import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/index';
import { gmailAccount, campaign, recipient } from '@/db/schema/index';
import { getSchedulerConfig, schedulerOpenNow } from '@/lib/scheduler-config';
import { statColumns } from '@/lib/stats';
import { getSession } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  if (!(await getSession())) redirect('/login');
  let db;
  try {
    db = getDb();
  } catch {
    return <NeedsSetup />;
  }

  // Independent queries — run them in parallel (this is the hottest page).
  const [cfg, accounts, campaigns, stats] = await Promise.all([
    getSchedulerConfig(db),
    db.select().from(gmailAccount),
    db.select().from(campaign),
    db
      .select({ campaignId: recipient.campaignId, ...statColumns })
      .from(recipient)
      .groupBy(recipient.campaignId),
  ]);
  const statById = new Map(stats.map((s) => [s.campaignId, s]));

  const open = schedulerOpenNow(cfg);
  const active = accounts.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected inboxes, send policy, and campaign performance at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Sending accounts" value={`${active}`} unit="active" sub={`${accounts.length} connected`} href="/accounts" />
        <Tile
          label="Scheduler"
          value={open ? 'Open' : cfg.enabled ? 'Idle' : 'Off'}
          dot={open ? 'good' : cfg.enabled ? 'warn' : 'off'}
          sub={`${cfg.windowStart}–${cfg.windowEnd} ${cfg.timezone} · ${cfg.hourlyMax}/hr`}
          href="/scheduler"
        />
        <Tile label="Campaigns" value={`${campaigns.length}`} unit="total" sub="all time" href="/campaigns/new" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Campaigns</h2>
          <Button asChild size="sm" variant="secondary">
            <Link href="/campaigns/new">New campaign</Link>
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <Card className="flex items-center justify-center border-dashed py-14 text-sm text-muted-foreground">
            No campaigns yet — connect an inbox, upload leads, then create one.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Replied</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const s = statById.get(c.id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="tnum text-right">{s?.sent ?? 0}</TableCell>
                      <TableCell className="tnum text-right">{s?.opened ?? 0}</TableCell>
                      <TableCell className="tnum text-right">{s?.replied ?? 0}</TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">{s?.total ?? 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  sub,
  href,
  dot,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  href: string;
  dot?: 'good' | 'warn' | 'off';
}) {
  const dotColor =
    dot === 'good' ? 'bg-emerald-400' : dot === 'warn' ? 'bg-amber-400' : 'bg-muted-foreground';
  return (
    <Link href={href}>
      <Card className="gap-0 p-5 transition-colors hover:border-foreground/20">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 flex items-baseline gap-2">
          {dot && <span className={`size-2 self-center rounded-full ${dotColor}`} />}
          <span className="tnum text-2xl font-semibold">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
      </Card>
    </Link>
  );
}

function NeedsSetup() {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5 p-6">
      <h2 className="font-semibold text-amber-300">Database not configured</h2>
      <p className="mt-2 text-sm text-amber-200/70">
        Set <code className="rounded bg-muted px-1">DATABASE_URL</code> in{' '}
        <code className="rounded bg-muted px-1">.env.local</code>, run{' '}
        <code className="rounded bg-muted px-1">npm run db:migrate</code>, then reload.
      </p>
    </Card>
  );
}
