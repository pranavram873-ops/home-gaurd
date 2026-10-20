import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/authContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Tamil Nadu Home Guards Supervision System',
  description: 'Official Operational & Field Supervision Platform for Tamil Nadu Home Guards & Civil Defence.',
  icons: {
    icon: '/images/tn-home-guards-logo.png',
    apple: '/images/tn-home-guards-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#f8fafd] text-[#0b1c30] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
