import type { Metadata } from "next";
import { Sora, Inter, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Scholar's Plot",
  description: "Student Planner & Productivity Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${sora.variable}
          ${inter.variable}
          ${ibmPlexMono.variable}
          antialiased
          bg-background
          text-foreground
        `}
      >
        <Providers>
          {children}
        </Providers>

        {/* Grain overlay — fixed texture on dark backgrounds */}
        <div className="grain-overlay" />

        {/* Sonner Toaster */}
        <Toaster position="bottom-right" richColors closeButton duration={3000} />
      </body>
    </html>
  );
}