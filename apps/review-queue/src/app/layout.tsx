import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import { SkipLink } from "@/components/common/skip-link";
import { NeonShell } from "@/components/neon/neon-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Review Queue",
  description: "Calm, structured pull request reviews.",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="h-dvh overflow-hidden">
        <SkipLink />
        <TooltipProvider>
          <NeonShell>{children}</NeonShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
