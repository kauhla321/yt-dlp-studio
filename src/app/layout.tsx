import type { Metadata } from "next";
import { IBM_Plex_Mono as ibmPlexMonoFont } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

// "mono night" type system: IBM Plex Mono for everything — UI copy, technical
// specs (file sizes, bitrates, paths, progress readouts), the lot.
const ibmPlexMono = ibmPlexMonoFont({
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
    <html lang="en" className={ibmPlexMono.variable}>
      <body className="font-mono">
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
