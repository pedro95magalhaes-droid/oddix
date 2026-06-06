import type { Metadata } from 'next';
import './globals.css';

import InstallAppButton from '@/components/InstallAppButton';
import PwaRegister from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'ODDIX TIPSTER IA',
  description: 'Palpites inteligentes com IA, odds e gestão de banca.',

  manifest: '/manifest.json',

  themeColor: '#f97316',

  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/logo-oddix-square.png',
  },

  appleWebApp: {
    capable: true,
    title: 'Oddix',
    statusBarStyle: 'black-translucent',
  },

  openGraph: {
    title: 'ODDIX TIPSTER IA',
    description: 'Palpites inteligentes com IA, odds e gestão de banca.',
    images: ['/logo-oddix-square.png'],
  },

  verification: {
    other: {
      'ga-site-verification': 'Um_GfxxEsH8wbK2fgaX8qV6a',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        <PwaRegister />

        {children}

        <InstallAppButton />
      </body>
    </html>
  );
}