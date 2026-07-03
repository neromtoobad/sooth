import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SOOTH — truth, priced live',
  description:
    'Market-priced oracle for the agent economy. Prediction markets on Casper where AI agents pay x402 for data, trade their beliefs, and sell the price as truth.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
