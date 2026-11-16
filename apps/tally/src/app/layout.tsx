import type { Metadata } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import { AppBar } from "@/components/neon/app-bar";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sans-face",
});
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face" });

export const metadata: Metadata = {
  title: "Tally",
  description: "Your reviews, pull requests and tickets at a glance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${atkinson.variable} ${jetbrainsMono.variable}`}>
      <body className="app">
        <AppBar />
        {children}
      </body>
    </html>
  );
}
