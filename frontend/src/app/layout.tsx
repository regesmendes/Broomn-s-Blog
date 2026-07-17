import type { Metadata } from 'next';
import { Cinzel, Lora } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Broomn's Blog",
  description: 'Chronicles from Broomn, the druid storyteller. A place for stories worth sharing around the fire.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={`${cinzel.variable} ${lora.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-gray-50 font-body dark:bg-gray-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
