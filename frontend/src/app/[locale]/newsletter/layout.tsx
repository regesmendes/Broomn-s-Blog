import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Newsletter | Blog do Broomn",
  description: 'Receba uma notificação quando novas histórias forem publicadas. Sem spam, cancele a qualquer momento.',
  openGraph: {
    title: "Newsletter | Blog do Broomn",
    description: 'Receba uma notificação quando novas histórias forem publicadas.',
  },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
