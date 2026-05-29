'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { sendJson } from '@/lib/client';

interface Config {
  enabled: boolean;
  hourlyMax: number;
  dailyMax: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  windowStart: string;
  windowEnd: string;
  timezone: string;
}

export function SchedulerForm({ initial }: { initial: Config }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cfg, setCfg] = useState<Config>(initial);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((c) => ({ ...c, [k]: v }));
  type NumKey = 'hourlyMax' | 'dailyMax' | 'minIntervalSeconds' | 'maxIntervalSeconds';
  const num = (k: NumKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, Number(e.target.value));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await sendJson('/v1/scheduler', cfg, 'PATCH');
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Couldn't save: ${json.error}`, { description: json.hint });
        return;
      }
      toast.success('Scheduler saved');
      router.refresh();
    });
  };

  return (
    <Card className="max-w-xl p-6">
      <form onSubmit={save} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Sending enabled</div>
            <div className="text-sm text-muted-foreground">Master switch for the drip sender.</div>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => set('enabled', v)} />
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <Num label="Max / hour" value={cfg.hourlyMax} onChange={num('hourlyMax')} />
          <Num label="Max / day" value={cfg.dailyMax} onChange={num('dailyMax')} />
          <Num label="Min interval (s)" value={cfg.minIntervalSeconds} onChange={num('minIntervalSeconds')} />
          <Num label="Max interval (s)" value={cfg.maxIntervalSeconds} onChange={num('maxIntervalSeconds')} />
          <Txt label="Window start" value={cfg.windowStart} onChange={(e) => set('windowStart', e.target.value)} placeholder="09:00" />
          <Txt label="Window end" value={cfg.windowEnd} onChange={(e) => set('windowEnd', e.target.value)} placeholder="17:00" />
        </div>

        <Txt
          label="Timezone (IANA)"
          value={cfg.timezone}
          onChange={(e) => set('timezone', e.target.value)}
          placeholder="America/New_York"
        />

        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save scheduler'}
        </Button>
      </form>
    </Card>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={onChange} className="tnum" />
    </div>
  );
}

function Txt({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}
