import { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { buildAlternates } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  return {
    title: "Newsletter | Blog do Broomn",
    description: 'Receba uma notificação quando novas histórias forem publicadas. Sem spam, cancele a qualquer momento.',
    openGraph: {
      title: "Newsletter | Blog do Broomn",
      description: 'Receba uma notificação quando novas histórias forem publicadas.',
    },
    alternates: buildAlternates(locale, '/newsletter'),
  };
}

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
