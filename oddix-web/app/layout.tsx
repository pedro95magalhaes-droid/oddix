import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ODDIX TIPSTER IA',
  description: 'Palpites inteligentes com IA, odds e gestão de banca.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/logo-oddix-square.png',
  },
  openGraph: {
    title: 'ODDIX TIPSTER IA',
    description: 'Palpites inteligentes com IA, odds e gestão de banca.',
    images: ['/logo-oddix-square.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
