import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Annapurna Trail • 3D First-Person Himalayan Trek',
  description:
    'A 3D first-person trekking game along the Annapurna Trail in Nepal. Explore a winding mountain trail, alpine pine forests, and distant snowy peaks in real-time WebGL.',
  keywords: [
    'Annapurna Trail',
    '3D Trekking Game',
    'Himalayas',
    'Three.js',
    'React Three Fiber',
    'First Person Game',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0b1526',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full bg-[#0b1526] text-white overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
