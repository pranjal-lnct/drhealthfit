import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DrHealthFit — Physiotherapy Exercise Assistant',
  description: 'AI-powered physiotherapy exercise guidance with real-time pose detection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-zinc-900">
        {children}
      </body>
    </html>
  );
}
