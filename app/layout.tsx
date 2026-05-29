import type { Metadata } from 'next';
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
        <Nav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
