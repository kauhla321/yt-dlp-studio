"use client";

/**
 * Next.js re-mounts template.tsx on every navigation (unlike layout.tsx, which
 * persists), so wrapping children here replays the entrance animation each time
 * the user switches sections (Download / Library / Settings).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in h-full">{children}</div>;
}
