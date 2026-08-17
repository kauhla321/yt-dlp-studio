import type { Metadata } from "next";
import { Inter, JetBrains_Mono as JetBrainsMono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

// "Studio Precision" type system: Inter for UI, JetBrains Mono for technical
// specs (file sizes, bitrates, paths, progress readouts).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrainsMono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "yt-dlp Studio",
  description: "A modern desktop-style web GUI for yt-dlp",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          {/* min-w-0 lets this flex child shrink below its content width so
              long paths / wide cards don't cause horizontal overflow. */}
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
