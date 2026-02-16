import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootClientWrapper from '@/components/RootClientWrapper';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Order My Saddle",
  description: "Order My Saddle",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" nonce={nonce}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} nonce={nonce}>
        <RootClientWrapper>{children}</RootClientWrapper>
      </body>
    </html>
  );
}
