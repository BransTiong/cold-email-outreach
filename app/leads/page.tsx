import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { leadList } from '@/db/schema/index';
import { getSession } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UploadForm } from './UploadForm';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  if (!(await getSession())) redirect('/login');
  const lists = await getDb().select().from(leadList).orderBy(desc(leadList.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV — the email column is auto-detected, the rest become merge fields.
        </p>
      </div>

      <UploadForm />

      {lists.length === 0 ? (
        <Card className="flex items-center justify-center border-dashed py-14 text-sm text-muted-foreground">
          No lists yet. Upload a CSV above.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>List ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {l.headers.map((h) => (
                        <Badge key={h} variant="secondary" className="font-normal">
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
