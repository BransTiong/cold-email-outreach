'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Column {
  original: string;
  key: string;
}
interface Preview {
  rowCount: number;
  columns: Column[];
  detectedEmailHeader: string | null;
  withEmail: number;
  withoutEmail: number;
  noEmailSample: string[];
}

// Columns to pre-check (by merge-field key) for a sensible default selection.
const DEFAULT_KEYS = new Set([
  'firstname',
  'lastname',
  'title',
  'companyname',
  'company',
  'email',
]);

export function UploadForm() {
  const router = useRouter();
  const [analyzing, startAnalyze] = useTransition();
  const [importing, startImport] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailColumn, setEmailColumn] = useState('');

  const reset = () => {
    setFile(null);
    setName('');
    setPreview(null);
    setSelected(new Set());
    setEmailColumn('');
  };

  const analyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Choose a CSV file first.');
    startAnalyze(async () => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/v1/lead-lists/preview', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Couldn't read CSV: ${json.error}`);
        return;
      }
      const p = json as Preview;
      setPreview(p);
      setEmailColumn(p.detectedEmailHeader ?? p.columns[0]?.original ?? '');
      setSelected(new Set(p.columns.filter((c) => DEFAULT_KEYS.has(c.key)).map((c) => c.original)));
    });
  };

  const toggle = (orig: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(orig) ? next.delete(orig) : next.add(orig);
      return next;
    });

  const runImport = () => {
    if (!file || !emailColumn) return;
    startImport(async () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name);
      fd.append('emailColumn', emailColumn);
      fd.append('columns', JSON.stringify([...selected]));
      const res = await fetch('/v1/lead-lists', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Import failed: ${json.error}`);
        return;
      }
      toast.success(`Imported ${json.imported} leads`, {
        description:
          json.skipped > 0
            ? `${json.skipped} skipped (no email): ${json.skippedSample.slice(0, 5).join(', ')}${json.skipped > 5 ? '…' : ''}`
            : `Fields: ${json.fields.join(', ')}`,
      });
      reset();
      router.refresh();
    });
  };

  // Step 1: pick a file.
  if (!preview) {
    return (
      <Card className="p-4">
        <form onSubmit={analyze} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="cursor-pointer file:mr-3 file:text-muted-foreground"
          />
          <Button type="submit" disabled={analyzing} className="sm:ml-auto">
            {analyzing ? 'Reading…' : 'Choose columns →'}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          We&apos;ll show the columns so you can pick which to import. Rows with no email are skipped.
        </p>
      </Card>
    );
  }

  // Step 2: choose columns + email + name, then import.
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm">
          <span className="font-medium">{preview.rowCount} rows</span>
          <span className="text-muted-foreground">
            {' · '}
            <span className="text-emerald-400">{preview.withEmail} with email</span>
            {preview.withoutEmail > 0 && (
              <span className="text-amber-400"> · {preview.withoutEmail} skipped (no email)</span>
            )}
          </span>
          {preview.withoutEmail > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              No-email rows won&apos;t be added: {preview.noEmailSample.slice(0, 5).join(', ')}
              {preview.withoutEmail > 5 ? `, +${preview.withoutEmail - 5} more` : ''}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>List name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={file?.name} />
        </div>
        <div className="grid gap-2">
          <Label>Email column</Label>
          <Select value={emailColumn} onValueChange={setEmailColumn}>
            <SelectTrigger>
              <SelectValue placeholder="Pick email column" />
            </SelectTrigger>
            <SelectContent>
              {preview.columns.map((c) => (
                <SelectItem key={c.original} value={c.original}>
                  {c.original}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Columns to import ({selected.size} selected)</Label>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(new Set(preview.columns.map((c) => c.original)))}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(new Set([emailColumn]))}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {preview.columns.map((c) => (
            <label
              key={c.original}
              className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-1.5 text-sm last:border-0 hover:bg-secondary/50"
            >
              <input
                type="checkbox"
                checked={selected.has(c.original)}
                onChange={() => toggle(c.original)}
                className="accent-emerald-500"
              />
              <span className="flex-1">{c.original}</span>
              <code className="text-xs text-muted-foreground">{`{{${c.key}}}`}</code>
            </label>
          ))}
        </div>
      </div>

      <Button onClick={runImport} disabled={importing || selected.size === 0}>
        {importing ? 'Importing…' : `Import ${preview.withEmail} leads`}
      </Button>
    </Card>
  );
}
