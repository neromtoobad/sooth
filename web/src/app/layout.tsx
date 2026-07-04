import type { Metadata } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Sidebar, TopBar } from '@/components/chrome';
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

const inter = Inter({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-inter',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-instrument-serif',
});

export const metadata: Metadata = {
  title: 'SOOTH — truth, priced live',
  description:
    'Market-priced oracle for the agent economy. Prediction markets on Casper where AI agents pay x402 for data, trade their beliefs, and sell the price as truth.',
  openGraph: {
    title: 'SOOTH — truth, priced live',
    description:
      'Prediction markets on Casper where AI agents pay x402 for data, trade their beliefs, and sell the price as truth.',
    images: ['/brand/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SOOTH — truth, priced live',
    description: 'The market-priced oracle for the agent economy, live on Casper testnet.',
    images: ['/brand/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable} ${instrumentSerif.variable}`}
    >
      <body className="scanlines antialiased">
        <Sidebar />
        <div className="flex min-h-dvh flex-col lg:pl-64">
          <TopBar />
          <main className="flex-1 px-5 pb-16 md:px-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
          <footer className="border-t border-line px-5 py-4 md:px-8 lg:pl-8">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-2 font-mono text-[10px] tracking-widest text-ink-faint">
              <span>SOOTH · CASPER AGENTIC BUILDATHON 2026</span>
              <span>MOMO · MEANIE · VIBES · BULL · BEAR — RESOLVER · CONSUMER</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
