import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { campaign } from '@/db/schema/index';
import { campaignStats } from '@/lib/stats';
import { getSession } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { CampaignControls } from './CampaignControls';

export const dynamic = 'force-dynamic';

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) redirect('/login');
  const { id } = await params;
  const db = getDb();
  // Both depend only on the route id, not on each other — fetch in parallel.
  const [[c], s] = await Promise.all([
    db.select().from(campaign).where(eq(campaign.id, id)),
    campaignStats(db, id),
  ]);
  if (!c) {
    return (
      <p className="text-sm text-muted-foreground">
        Campaign not found.{' '}
        <Link href="/" className="text-foreground underline">
          Back to dashboard
        </Link>
      </p>
    );
  }

  const cells: [string, number][] = [
    ['Total', s.total],
    ['Queued', s.queued],
    ['Sent', s.sent],
    ['Opened', s.opened],
    ['Replied', s.replied],
    ['Failed', s.failed],
    ['Unsubscribed', s.unsubscribed],
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <StatusBadge status={c.status} />
        </div>
        <CampaignControls id={c.id} status={c.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cells.map(([label, n]) => (
          <Card key={label} className="gap-0 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="tnum mt-1 text-2xl font-semibold">{n}</div>
          </Card>
        ))}
      </div>

      <Card className="gap-3 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</div>
        <div className="font-mono text-sm">{c.subjectTemplate}</div>
        <div className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Body</div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-sm text-muted-foreground">
          {c.bodyTemplate}
        </pre>
      </Card>
    </div>
  );
}
