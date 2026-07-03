import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Chrome } from '@/components/chrome';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-space-grotesk',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'SOOTH — truth, priced live',
  description:
    'Market-priced oracle for the agent economy. Prediction markets on Casper where AI agents pay x402 for data, trade their beliefs, and sell the price as truth.',
  openGraph: {
    title: 'SOOTH — truth, priced live',
    description:
      'Prediction markets on Casper where AI agents pay x402 for data, trade their beliefs, and sell the price as truth.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SOOTH — truth, priced live',
    description: 'The market-priced oracle for the agent economy, live on Casper testnet.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="scanlines antialiased">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <Chrome />
          <main>{children}</main>
          <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-line pt-3 font-mono text-[10px] tracking-widest text-ink-faint">
            <span>SOOTH · CASPER AGENTIC BUILDATHON 2026</span>
            <span>TRADERS: MOMO · MEANIE · VIBES · BULL · BEAR — RESOLVER · CONSUMER</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
