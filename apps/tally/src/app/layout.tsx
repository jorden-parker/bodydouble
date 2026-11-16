import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppBar } from "@/components/neon/app-bar";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans-face" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono-face" });

export const metadata: Metadata = {
  title: "Tally",
  description: "Your reviews, pull requests and tickets at a glance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="app">
        <AppBar />
        {children}
      </body>
    </html>
  );
}
