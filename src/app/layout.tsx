import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/authContext';
import { DivisionProvider } from '@/lib/attendance/divisionContext';

/*
 * Manrope has clean, open forms for operational dashboards and remains highly
 * legible in dense tables, forms and status indicators.
 */
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
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
    <html lang="en" className={manrope.variable}>
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
