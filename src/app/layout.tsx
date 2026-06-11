import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Andante Labs · Queue Manager',
  description: 'Robust Solace PubSub+ publish/subscribe console by Andante Labs.',
  icons: { icon: '/assets/andante-logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
