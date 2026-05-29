'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sendJson } from '@/lib/client';

export function AccountActions({ id, paused }: { id: string; paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () => {
    start(async () => {
      const res = await sendJson(`/v1/accounts/${id}/pause`, { paused: !paused });
      if (!res.ok) {
        toast.error('Could not update account');
        return;
      }
      toast.success(paused ? 'Account resumed' : 'Account paused');
      router.refresh();
    });
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={pending}>
      {pending ? '…' : paused ? 'Resume' : 'Pause'}
    </Button>
  );
}
