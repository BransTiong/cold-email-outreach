'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth-client';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/leads', label: 'Leads' },
  { href: '/campaigns/new', label: 'Campaign' },
  { href: '/scheduler', label: 'Scheduler' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400/50" />
          coldmail
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-md px-2.5 py-1.5 transition-colors',
                  active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await signOut();
            router.push('/login');
            router.refresh();
          }}
          className="ml-auto rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
