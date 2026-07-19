import type { Metadata } from 'next';
import { Cinzel, Lora } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
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
  title: "Blog do Broomn",
  description: 'Crônicas de Broomn, o druida contador de histórias. Um lugar para histórias que merecem ser compartilhadas ao redor da fogueira.',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={`${cinzel.variable} ${lora.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-gray-50 font-body dark:bg-gray-900">
        {/* Apply saved theme before first paint to avoid flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
        <GoogleAnalytics />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
