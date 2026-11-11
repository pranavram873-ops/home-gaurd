import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/authContext';
import { DivisionProvider } from '@/lib/attendance/divisionContext';

/*
 * IBM Plex Sans has a calm, workmanlike voice that stays clear in dense
 * personnel tables and operational forms.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TN Home Guards | Field Operations',
  description: 'Attendance, duty coordination, and personnel operations for Tamil Nadu Home Guards.',
  icons: {
    icon: '/images/tn-home-guards-logo.png',
    apple: '/images/tn-home-guards-logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#102a43',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plexSans.variable}>
      <head>
        {/*
          Material Symbols is an icon font: a glyph is picked by typing its
          ligature name (`fact_check`, `groups`). It comes from the Google Fonts
          stylesheet rather than next/font/local because subsetting a variable
          icon font is unpredictable - asking for one more ligature multiplied
          the file 400x - so the set could not be grown safely in place.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface font-sans text-on-surface antialiased">
        <AuthProvider>
          <DivisionProvider>{children}</DivisionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
