import { redirect } from 'next/navigation';
import { getDb } from '@/db/index';
import { gmailAccount } from '@/db/schema/index';
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
import { AccountActions } from './AccountActions';

export const dynamic = 'force-dynamic';

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  if (!(await getSession())) redirect('/login');
  const { connected } = await searchParams;
  const rows = await getDb().select().from(gmailAccount);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gmail accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inboxes the sender rotates across.</p>
        </div>
        <Button asChild>
          <a href="/v1/accounts/oauth/start">Connect Gmail</a>
        </Button>
      </div>

      {connected && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-300">
          Connected <span className="font-medium">{connected}</span>.
        </Card>
      )}

      {rows.length === 0 ? (
        <Card className="flex items-center justify-center border-dashed py-14 text-sm text-muted-foreground">
          No accounts connected. Click “Connect Gmail” and approve the consent screen.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent today</TableHead>
                <TableHead>Last sent</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="tnum text-right">{a.sentToday}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.lastSentAt ? new Date(a.lastSentAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status !== 'revoked' && <AccountActions id={a.id} paused={a.status === 'paused'} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
