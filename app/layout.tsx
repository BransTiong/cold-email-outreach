import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Nav } from '@/components/nav';
import { Toaster } from '@/components/ui/sonner';

// Inter is the only typeface — text and numbers.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'coldmail',
  description: 'Multi-account Gmail cold-email console',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn('h-full dark antialiased', inter.variable)} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400/50" />
              coldmail
            </Link>
            <Nav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
