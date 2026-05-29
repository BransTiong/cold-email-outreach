'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signIn, signUp } from '@/lib/auth-client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res =
        mode === 'signin'
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name || email.split('@')[0]! });
      if (res.error) {
        toast.error(res.error.message ?? 'Authentication failed');
        return;
      }
      toast.success(mode === 'signin' ? 'Welcome back' : 'Account created');
      router.push('/');
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400/50" />
          <span className="font-semibold tracking-tight">coldmail</span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          {mode === 'signin' ? 'Sign in' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'signin' ? 'Access your outreach console.' : 'Set up the owner account.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Branson" />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in'}
        </button>
      </Card>
    </div>
  );
}
