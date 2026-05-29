'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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

type Field = 'subject' | 'body';

export function CampaignForm({ lists }: { lists: List[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [testTo, setTestTo] = useState('');

  // Track which template field the cursor is in, so a merge-field click inserts
  // there. Default to body (the main content).
  const [activeField, setActiveField] = useState<Field>('body');
  // After we splice a token into a controlled value, restore the caret once the
  // new value has committed to the DOM.
  const pendingCaret = useRef<{ field: Field; pos: number } | null>(null);

  useEffect(() => {
    const p = pendingCaret.current;
    if (!p) return;
    pendingCaret.current = null;
    const el = document.getElementById(p.field) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (el) {
      el.focus();
      el.setSelectionRange(p.pos, p.pos);
    }
  }, [subject, body]);

  const fields = lists.find((l) => l.id === listId)?.headers ?? [];

  const insertToken = (key: string) => {
    const token = `{{${key}}}`;
    const el = document.getElementById(activeField) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    const value = activeField === 'subject' ? subject : body;
    const setValue = activeField === 'subject' ? setSubject : setBody;
    // Insert at the caret/selection if the field is focused, else append.
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + token + value.slice(end));
    pendingCaret.current = { field: activeField, pos: start + token.length };
  };

  const sendTest = () => {
    if (!subject || !body) {
      toast.error('Add a subject and body first.');
      return;
    }
    startTest(async () => {
      const res = await sendJson('/v1/test-send', {
        to: testTo,
        listId,
        subjectTemplate: subject,
        bodyTemplate: body,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Test failed: ${json.error}${json.detail ? ` — ${json.detail}` : ''}`);
        return;
      }
      toast.success(`Test sent to ${json.sentTo}`, {
        description: `From ${json.from} · merge fields from ${json.usedLead}`,
      });
    });
  };

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

        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            Merge fields — click to insert into the {activeField}:
          </div>
          {fields.length ? (
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => insertToken(f)}
                  className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300"
                >
                  {`{{${f}}}`}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">none</span>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setActiveField('subject')}
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
            onFocus={() => setActiveField('body')}
            required
            rows={8}
            className="font-mono text-sm"
            placeholder={'<p>Hi {{firstName}},</p>\n<p>I saw {{companyName}} and ...</p>'}
          />
        </div>

        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <div className="text-sm font-medium">Send a test</div>
          <p className="mb-2 text-xs text-muted-foreground">
            Delivers this exact email to one address, with merge fields filled from the first lead in
            the selected list — great for a quick demo.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              className="sm:flex-1"
            />
            <Button type="button" variant="secondary" onClick={sendTest} disabled={testing || !testTo}>
              {testing ? 'Sending…' : 'Send test'}
            </Button>
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create campaign'}
        </Button>
      </form>
    </Card>
  );
}
