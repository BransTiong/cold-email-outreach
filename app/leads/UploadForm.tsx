'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function UploadForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (!(data.get('file') as File)?.size) {
      toast.error('Choose a CSV file first.');
      return;
    }
    start(async () => {
      const res = await fetch('/v1/lead-lists', { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Upload failed: ${json.error}`, {
          description: json.headers ? `Columns found: ${json.headers.join(', ')}` : undefined,
        });
        return;
      }
      toast.success(`Imported ${json.imported} leads`, {
        description: `${json.skipped} skipped · fields: ${json.fields.join(', ')}`,
      });
      form.reset();
      router.refresh();
    });
  };

  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input name="name" placeholder="List name (optional)" className="sm:max-w-xs" />
        <Input
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="cursor-pointer file:mr-3 file:text-muted-foreground"
        />
        <Button type="submit" disabled={pending} className="sm:ml-auto">
          {pending ? 'Uploading…' : 'Upload CSV'}
        </Button>
      </form>
    </Card>
  );
}
