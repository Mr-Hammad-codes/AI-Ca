import "./globals.css";
import Link from "next/link";
import { AuditProvider } from "./context";

export const metadata = {
  title: "AI-CA Enterprise",
  description: "Neuro-Symbolic Governance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <AuditProvider>
          {/* Global Enterprise Navigation */}
          <nav className="bg-slate-900 text-slate-200 px-8 py-4 flex justify-between items-center shadow-md">
            <div className="font-bold text-lg tracking-widest text-emerald-400">AI-CA ENGINE</div>
            <div className="flex space-x-6 text-sm font-medium">
              <Link href="/" className="hover:text-emerald-400 transition-colors">Audit Console</Link>
              <Link href="/analytics" className="hover:text-emerald-400 transition-colors">Telemetry</Link>
              <Link href="/settings" className="hover:text-emerald-400 transition-colors">Governance Policies</Link>
            </div>
          </nav>
          
          {children}
        </AuditProvider>
      </body>
    </html>
  );
}