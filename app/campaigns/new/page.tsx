import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { leadList } from '@/db/schema/index';
import { getSession } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { CampaignForm } from './CampaignForm';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  if (!(await getSession())) redirect('/login');
  const lists = await getDb()
    .select({ id: leadList.id, name: leadList.name, headers: leadList.headers })
    .from(leadList)
    .orderBy(desc(leadList.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Template a message against a lead list, then launch it into the send queue.
        </p>
      </div>

      {lists.length === 0 ? (
        <Card className="flex items-center justify-center border-dashed py-14 text-sm text-muted-foreground">
          Upload a lead list first on the{' '}
          <Link href="/leads" className="ml-1 text-foreground underline">
            Leads
          </Link>
          &nbsp;page.
        </Card>
      ) : (
        <CampaignForm lists={lists} />
      )}
    </div>
  );
}
