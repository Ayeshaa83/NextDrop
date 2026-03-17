import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import GlobalPlayer from "../components/GlobalPlayer";
import { Providers } from "./providers";
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
  title: "NextDrop - Artist-First Music Distribution",
  description: "AI-powered music distribution and analytics platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-bg-deep text-[#f0f0f5] antialiased min-h-screen selection:bg-primary/30 selection:text-primary-100`}
      >
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <Header />
              <main className="flex-1 overflow-y-auto relative scroll-smooth pb-32">
                {children}
              </main>
            </div>
          </div>
          <GlobalPlayer />
        </Providers>
      </body>
    </html>
  );
}
