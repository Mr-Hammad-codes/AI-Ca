"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { useAudit, AuditProvider } from "./context"; // <-- Imported AuditProvider here
import { Playfair_Display, Montserrat } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600", "700"] });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600"] });

// Renamed from Home to DashboardWorkspace
function DashboardWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [error, setError] = useState<string>("");
  
  const { customPolicy, result, setResult, history, setHistory, chatLog, setChatLog } = useAudit();

  const [chatQuestion, setChatQuestion] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [rollbackReason, setRollbackReason] = useState<string>("");
  const [rollbackMsg, setRollbackMsg] = useState<string>("");

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const themeVars = (theme === 'light' ? {
    '--bg-primary': '#F6F5EC',     
    '--bg-secondary': '#EFE7DA',   
    '--border': '#E1DACA',         
    '--accent': '#B29079',         
    '--text-primary': '#110F0E',   
    '--text-secondary': '#67635F', 
    '--badge-bg': '#E1DACA',       
  } : {
    '--bg-primary': '#110F0E',     
    '--bg-secondary': '#313130',   
    '--border': '#67635F',         
    '--accent': '#562508',         
    '--text-primary': '#E2DBCA',   
    '--text-secondary': '#C1B6A4', 
    '--badge-bg': '#313130',       
  }) as React.CSSProperties;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
      setChatLog([]);
    }
  };

  const clearSession = () => {
    setResult(null);
    setFile(null);
    setChatLog([]);
    setError("");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const handleUpload = async (runAgent: boolean) => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("execute_agent", runAgent ? "true" : "false"); 
    formData.append("custom_policy", customPolicy); 

    try {
      const response = await fetch("http://localhost:8000/upload-invoice/", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed");
      }
      const data = await response.json();
      const newRecord = data.audit_record;
      setResult(newRecord);
      setHistory([...history, newRecord]);
      setChatLog([{ sender: "AI", text: `Connected to document context for ${newRecord.vendor_name}. Ask me anything about this audit!` }]);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during upload.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatQuestion.trim() || !result) return;
    const userQ = chatQuestion;
    setChatQuestion("");
    const updatedChat = [...chatLog, { sender: "User", text: userQ }];
    setChatLog(updatedChat);
    setChatLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat-invoice/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQ, vendor_name: result.vendor_name }),
      });
      const data = await res.json();
      setChatLog([...updatedChat, { sender: "AI", text: data.answer }]);
    } catch {
      setChatLog([...updatedChat, { sender: "AI", text: "Error connecting to conversational context engine." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!result) return;
    try {
      const res = await fetch("http://localhost:8000/rollback-ledger/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_block_hash: result.block_hash, reason: rollbackReason || "Manual Audit Correction" }),
      });
      const data = await res.json();
      setRollbackMsg(`✓ Success: Reversing block created (${data.reversing_block_hash.substring(0, 12)}...)`);
    } catch {
      setRollbackMsg("Rollback failed.");
    }
  };

  const handleReadAloud = (text: string) => {
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; 
      utterance.pitch = 1;

      utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
      utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDownloadCertificate = () => {
    if (!result) return;
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleString();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); 
    doc.text("AI-CA ENTERPRISE AUDIT CERTIFICATE", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Timestamp: ${dateStr}`, 20, 32);
    doc.text(`Vendor: ${result.vendor_name}`, 20, 38);
    doc.text(`State: ${result.approval_state}`, 20, 44);
    doc.save(`Enterprise_Audit_${result.vendor_name.replace(/\s+/g, '_')}.pdf`);
  };

  const getCurrencySymbol = (code?: string) => code === "USD" ? "$" : code === "EUR" ? "€" : code === "GBP" ? "£" : "₹";

  return (
    <main 
      style={themeVars}
      className={`${montserrat.className} relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-500 overflow-x-hidden`}
    >
      
      {/* Top Floating Controls */}
      <div className="fixed top-20 right-8 z-50 flex space-x-3">
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] hover:opacity-80 transition-opacity shadow-sm flex items-center justify-center"
          title="Toggle Theme"
        >
          {theme === 'light' ? (
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          ) : (
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          )}
        </button>
        <button
          onClick={() => setIsDevMode(!isDevMode)}
          className="text-xs px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] hover:opacity-80 transition-opacity shadow-sm font-medium"
        >
          {isDevMode ? "🧠 Neural Trace: ACTIVE" : "Neural Trace: OFF"}
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center pt-20 pb-8 text-center px-4">
        <h1 className={`${playfair.className} text-5xl sm:text-6xl font-bold tracking-tight mb-4`}>
          AI-CA Enterprise
        </h1>
        <p className="text-[var(--text-secondary)] max-w-xl text-sm leading-relaxed">
          Neuro-Symbolic Governance, ESG, Conversational Context & Treasury Optimization powered by autonomous intelligence.
        </p>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto w-full p-6 pb-24">
        
        {!result ? (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 shadow-lg transition-all">
            <h2 className={`${playfair.className} text-xl font-bold mb-3`}>Document Ingestion</h2>
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-grow p-3 border border-dashed border-[var(--border)] rounded-lg bg-[var(--bg-primary)] w-full">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-[var(--text-secondary)] file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[var(--accent)] file:text-[var(--bg-primary)] hover:file:opacity-90 cursor-pointer transition-all"
                />
              </div>
              <div className="flex space-x-2 w-full md:w-auto">
                <button onClick={() => handleUpload(false)} disabled={loading} className="w-full md:w-32 py-2 rounded-lg bg-[var(--border)] hover:opacity-80 text-[var(--text-primary)] text-xs font-semibold transition-all">
                  Standard Audit
                </button>
                <button onClick={() => handleUpload(true)} disabled={loading} className="w-full md:w-32 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 text-xs font-semibold transition-all shadow-md">
                  Agentic Workflow
                </button>
              </div>
            </div>
            {loading && <p className="mt-4 text-center animate-pulse text-xs font-medium text-[var(--accent)]">Processing Telemetry...</p>}
            {error && <div className="mt-4 p-3 border border-red-500/30 text-red-600 bg-red-500/10 rounded-lg text-xs font-medium">{error}</div>}
          </div>
        ) : (
          <div className="flex justify-between items-center bg-[var(--bg-secondary)] border border-[var(--border)] p-4 rounded-xl shadow-sm transition-all">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">Active Session Rendered</p>
              <h2 className={`${playfair.className} text-lg font-bold`}>Viewing Audit: {result.vendor_name}</h2>
            </div>
            <button onClick={clearSession} className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] hover:opacity-80 text-[var(--text-primary)] text-xs font-semibold transition-all shadow-sm">
              Clear Session
            </button>
          </div>
        )}

        {result && (
          <div className="animate-fade-in-up mt-6 space-y-6">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 shadow-lg transition-all">
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className={`${playfair.className} text-2xl font-bold`}>{result.vendor_name}</h2>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mt-1">RBAC Status: {result.status}</p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--badge-bg)] border border-[var(--border)] text-[var(--text-primary)]">
                    {result.approval_state}
                  </span>
                  <button onClick={handleDownloadCertificate} className="text-xs font-semibold text-[var(--accent)] hover:opacity-70 underline transition-all">
                    Download PDF Certificate
                  </button>
                </div>
              </div>
              
              <hr className="my-5 border-[var(--border)] opacity-50" />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-3 bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border)]">
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Financial Ledger</h3>
                  <div className="flex justify-between items-center text-xs">
                    <span>Reported Total</span>
                    <span className="font-medium">{getCurrencySymbol(result.currency)}{result.reported_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Engine Total</span>
                    <span className="font-medium">{getCurrencySymbol(result.currency)}{result.calculated_total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3 bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border)]">
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">AML Fraud Radar</h3>
                  <div className="flex justify-between items-center text-xs">
                    <span>Threat Index</span>
                    <span className="font-medium">{result.risk_score} / 100</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>ERP PO Match</span>
                    <span className="font-medium">{result.po_status}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-3 bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border)]">
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">ESG Carbon Accounting</h3>
                  <div className="flex justify-between items-center text-xs">
                    <span>Total Estimated CO2e</span>
                    <span className="font-bold text-[var(--accent)]">{result.esg_metrics.total_co2} kg</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-[var(--text-secondary)]">
                    <span>Hardware: {result.esg_metrics.hardware_co2}kg</span>
                    <span>Cloud: {result.esg_metrics.cloud_co2}kg</span>
                    <span>Travel: {result.esg_metrics.travel_co2}kg</span>
                  </div>
                </div>

                <div className="space-y-3 bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border)]">
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Temporal Accrual Engine</h3>
                  <div className="flex justify-between items-center text-xs">
                    <span>Cadence Status</span>
                    <span className="font-medium">{result.temporal_accrual.accrual_status}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-[var(--text-secondary)]">
                    <span>Billing Cycle: {result.temporal_accrual.billing_cadence_days} Days</span>
                    <span>Next: {result.temporal_accrual.projected_next_billing}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border)] mb-5">
                <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Treasury Yield Optimizer</h3>
                <div className="flex justify-between items-center text-xs">
                  <span>Recommended Action</span>
                  <span className="font-medium">{result.treasury_optimization.recommendation}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-[var(--text-secondary)] mt-1">
                  <span>Discount Terms: {result.treasury_optimization.discount_offered}</span>
                  <span>Projected Net Benefit: {getCurrencySymbol(result.currency)}{result.treasury_optimization.projected_net_benefit.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Policy Compliance</h3>
                {result.policy_violations.length > 0 ? (
                  <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-lg">
                    <ul className="list-disc pl-5 space-y-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      {result.policy_violations.map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-medium">
                    ✓ Clean Audit: Zero policy or ESG violations detected.
                  </div>
                )}
              </div>

              <hr className="my-5 border-[var(--border)] opacity-50" />
              
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Conversational Intelligence</h3>
                <div className="p-4 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] space-y-3">
                  
                  <div className="max-h-64 overflow-y-auto space-y-3 p-2 rounded-lg scroll-smooth">
                    {chatLog.map((msg, i) => (
                      <div key={i} className={`text-xs p-3 rounded-lg border border-[var(--border)] w-fit max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm ${msg.sender === "AI" ? "bg-[var(--bg-secondary)]" : "bg-[var(--accent)] text-[var(--bg-primary)] ml-auto"}`}>
                        <span className="font-bold opacity-75 text-[10px] block mb-1.5 uppercase tracking-wide">{msg.sender}</span>
                        {msg.text}
                      </div>
                    ))}
                    {chatLoading && <div className="text-xs animate-pulse p-2 opacity-70">Synthesizing document context...</div>}
                  </div>
                  
                  <div className="flex space-x-2 pt-1">
                    <input 
                      type="text" 
                      placeholder="Ask about line items, terms, or ESG data..."
                      className="w-full text-xs p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] transition-colors text-[var(--text-primary)]"
                      value={chatQuestion}
                      onChange={(e) => setChatQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    />
                    <button onClick={handleSendChat} className="px-4 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md">
                      Send
                    </button>
                  </div>
                </div>
              </div>

              {result.payment_strategy !== "N/A" && (
                <>
                  <hr className="my-5 border-[var(--border)] opacity-50" />
                  <div className="space-y-3">
                    <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Agentic Actions</h3>
                    <div className="flex justify-between items-center p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-xs">
                      <span>Applied Strategy</span>
                      <span className="font-medium text-[var(--text-primary)]">{result.payment_strategy.replace(/_/g, " ")}</span>
                    </div>

                    {result.vendor_email_draft !== "N/A" && (
                      <div className="mt-3 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border)] shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
                            <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Remediation Draft</h3>
                          </div>
                          
                          <button 
                            onClick={() => handleReadAloud(result.vendor_email_draft)}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm flex items-center space-x-1"
                          >
                            <span>{isSpeaking ? (isPaused ? "▶ Resume" : "⏸ Pause") : "▶ Listen"}</span>
                          </button>
                        </div>
                        <p className="text-xs whitespace-pre-wrap leading-relaxed opacity-90">
                          {result.vendor_email_draft}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <hr className="my-5 border-[var(--border)] opacity-50" />
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Immutable Block Ledger</h3>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Rollback Reason..."
                      className="text-xs p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] w-40 focus:outline-none text-[var(--text-primary)]"
                      value={rollbackReason}
                      onChange={(e) => setRollbackReason(e.target.value)}
                    />
                    <button onClick={handleRollback} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white border-none text-[10px] font-bold transition-all shadow-sm">
                      Revert Block
                    </button>
                  </div>
                </div>
                {rollbackMsg && <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{rollbackMsg}</p>}

                <div className="flex flex-col md:flex-row items-center justify-center space-y-3 md:space-y-0 md:space-x-4 p-4 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)]">
                  <div className="w-full md:w-5/12 bg-[var(--bg-secondary)] border-2 border-dashed border-[var(--border)] rounded-lg p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Block N-1</p>
                    <div className="bg-[var(--bg-primary)] p-2 rounded-md mt-1 border border-[var(--border)]">
                      <p className="font-mono text-[10px] opacity-70 truncate">{result.prev_hash}</p>
                    </div>
                  </div>
                  <div className="w-full md:w-5/12 bg-[var(--bg-secondary)] border-2 border-[var(--border)] rounded-lg p-3 text-center shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[var(--accent)] opacity-80"></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5 text-[var(--text-primary)]">Block N (Sealed)</p>
                    <div className="bg-[var(--bg-primary)] p-2 rounded-md mt-1 border border-[var(--border)]">
                      <p className="font-mono text-[10px] truncate text-[var(--text-primary)]">{result.block_hash}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isDevMode && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-4 rounded-xl shadow-md mt-6">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-[var(--text-secondary)]">Raw Telemetry & Payload</h3>
                </div>
                <div className="bg-[var(--bg-primary)] p-3 rounded-lg text-[10px] font-mono overflow-x-auto border border-[var(--border)] opacity-80">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================================================
// NEW DEFAULT EXPORT: Safely Wraps the Entire Dashboard inside AuditProvider
// ============================================================================
export default function Home() {
  return (
    <AuditProvider>
      <DashboardWorkspace />
    </AuditProvider>
  );
}