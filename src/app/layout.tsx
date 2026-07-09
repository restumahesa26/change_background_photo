import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudioPasfoto.ai - Automated Passport Photo Background Changer",
  description: "Instantly remove background and change background colors of your photo to standard Red or Blue passport dimensions (3x4, 4x6, 2x3) using AI in your browser.",
  keywords: ["passport background changer", "pasfoto merah", "pasfoto biru", "ai background remover", "passport photo maker", "indonesia pasfoto online"],
  authors: [{ name: "StudioPasfoto.ai" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50/50">
        {children}
      </body>
    </html>
  );
}
