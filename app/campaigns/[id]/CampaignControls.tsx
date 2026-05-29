'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sendJson } from '@/lib/client';

export function CampaignControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const call = (path: string, body: unknown, ok: string) =>
    start(async () => {
      const res = await sendJson(path, body);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(`Failed: ${j.error ?? res.status}`);
        return;
      }
      toast.success(ok);
      router.refresh();
    });

  if (status === 'draft') {
    return (
      <Button onClick={() => call(`/v1/campaigns/${id}/launch`, undefined, 'Campaign launched')} disabled={pending}>
        {pending ? '…' : 'Launch'}
      </Button>
    );
  }
  if (status === 'sending') {
    return (
      <Button variant="secondary" onClick={() => call(`/v1/campaigns/${id}/pause`, { paused: true }, 'Paused')} disabled={pending}>
        {pending ? '…' : 'Pause'}
      </Button>
    );
  }
  if (status === 'paused') {
    return (
      <Button onClick={() => call(`/v1/campaigns/${id}/pause`, { paused: false }, 'Resumed')} disabled={pending}>
        {pending ? '…' : 'Resume'}
      </Button>
    );
  }
  return null;
}
