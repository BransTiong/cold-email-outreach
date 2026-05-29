'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sendJson } from '@/lib/client';

interface List {
  id: string;
  name: string;
  headers: string[];
}

export function CampaignForm({ lists }: { lists: List[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const fields = lists.find((l) => l.id === listId)?.headers ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await sendJson('/v1/campaigns', {
        name,
        listId,
        subjectTemplate: subject,
        bodyTemplate: body,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Could not create campaign: ${json.error}`);
        return;
      }
      if (json.unknownFields?.length) {
        toast.warning('Created with unknown fields', {
          description: `These aren't in the list and will render blank: ${json.unknownFields.join(', ')}`,
        });
      } else {
        toast.success('Campaign created');
      }
      router.push(`/campaigns/${json.id}`);
    });
  };

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-2">
          <Label htmlFor="name">Campaign name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Q2 outreach" />
        </div>

        <div className="grid gap-2">
          <Label>Lead list</Label>
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a list" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Merge fields:</span>
          {fields.length ? (
            fields.map((f) => (
              <Badge key={f} variant="secondary" className="font-mono font-normal">
                {`{{${f}}}`}
              </Badge>
            ))
          ) : (
            <span>none</span>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="Quick question, {{firstName}}"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="body">Body (HTML allowed)</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={8}
            className="font-mono text-sm"
            placeholder={'<p>Hi {{firstName}},</p>\n<p>I saw {{company}} and ...</p>'}
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create campaign'}
        </Button>
      </form>
    </Card>
  );
}
