import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-CA Enterprise",
  description: "Neuro-Symbolic Governance & Autonomous Audit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-500 antialiased">
        
        {/* SINGLE THEMED NAVBAR (No Context Conflicts) */}
        <nav className="border-b border-[var(--border)] bg-[var(--bg-secondary)] px-8 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm transition-colors duration-500">
          <div className="font-bold text-lg tracking-widest uppercase">
            AI-CA <span className="text-[var(--accent)]">Engine</span>
          </div>
          <div className="hidden md:flex space-x-8 text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            <span className="hover:text-[var(--accent)] cursor-pointer transition-colors">Audit Console</span>
            <span className="hover:text-[var(--accent)] cursor-pointer transition-colors">Telemetry</span>
            <span className="hover:text-[var(--accent)] cursor-pointer transition-colors">Governance Policies</span>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}