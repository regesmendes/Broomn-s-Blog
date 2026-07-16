import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Newsletter | Broomn's Blog",
  description: 'Subscribe to get notified when new posts are published. No spam, unsubscribe anytime.',
  openGraph: {
    title: "Newsletter | Broomn's Blog",
    description: 'Subscribe to get notified when new posts are published.',
  },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
