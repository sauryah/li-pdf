import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';

export const metadata: Metadata = {
  title: 'li.pdf — Universal Document & Image Converter, Compressor',
  description: 'Fast, privacy-first universal file utility. Compress, convert, split, and merge PDFs and images with verified ephemeral auto-deletion.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-blue-500 selection:text-white">
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)] flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
