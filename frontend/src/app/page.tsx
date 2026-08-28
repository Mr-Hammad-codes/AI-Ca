"use client";

import { useState } from "react";
import { Card, Title, Text, Button, Divider, Badge } from "@tremor/react";
import jsPDF from "jspdf";
import { useAudit } from "./context";
import { BloomBackground } from "./components/ui/bloom-animation-background";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  
  const { customPolicy, result, setResult, history, setHistory, chatLog, setChatLog } = useAudit();

  const [chatQuestion, setChatQuestion] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  const [rollbackReason, setRollbackReason] = useState<string>("");
  const [rollbackMsg, setRollbackMsg] = useState<string>("");

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

  const getCurrencySymbol = (currencyCode?: string) => {
    if (currencyCode === "USD") return "$";
    if (currencyCode === "EUR") return "€";
    if (currencyCode === "GBP") return "£";
    return "₹";
  };

  const getRiskBadgeColor = (score: number) => {
    if (score < 20) return "emerald";
    if (score < 50) return "yellow";
    return "red";
  };

  const getApprovalBadgeColor = (state: string) => {
    if (state === "AUTO_APPROVED") return "emerald";
    if (state === "PENDING_AUDITOR_REVIEW") return "orange";
    return "red";
  };

  const handleReadAloud = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; 
      utterance.pitch = 1;
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

    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175); 
    doc.text("--- FINANCIAL, ESG & TREASURY METRICS ---", 20, 56);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(`Reported Total: ${result.currency} ${result.reported_total.toFixed(2)}`, 20, 64);
    doc.text(`Calculated Engine: ${result.currency} ${result.calculated_total.toFixed(2)}`, 20, 70);
    doc.text(`Scope 3 Carbon Footprint: ${result.esg_metrics.total_co2} kg CO2e`, 20, 76);
    doc.text(`Temporal Accrual Status: ${result.temporal_accrual.accrual_status}`, 20, 82);
    doc.text(`Treasury Strategy: ${result.treasury_optimization.recommendation}`, 20, 88);
    doc.text(`Projected Yield Benefit: ${result.currency} ${result.treasury_optimization.projected_net_benefit.toFixed(2)}`, 20, 94);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(6, 78, 59); 
    doc.text("--- CRYPTOGRAPHIC PROOF ---", 20, 108);
    doc.setFontSize(8);
    doc.setFont("courier", "normal"); 
    doc.setTextColor(71, 85, 105); 
    doc.text(`Prev Hash: ${result.prev_hash}`, 20, 116);
    doc.text(`Block Hash: ${result.block_hash}`, 20, 124);

    doc.save(`Enterprise_Audit_${result.vendor_name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      
      {/* BLOOM UNICORN STUDIO BACKGROUND */}
      <BloomBackground />

      {/* Dev Mode Floating Button */}
      <div className="fixed top-6 right-8 z-50">
        <button
          onClick={() => setIsDevMode(!isDevMode)}
          className={`text-xs px-4 py-2 rounded-full border transition-all duration-300 font-medium shadow-md ${
            isDevMode 
              ? "bg-slate-900 text-emerald-400 border-slate-700 shadow-inner" 
              : "bg-white/90 backdrop-blur text-slate-700 border-slate-200 hover:bg-white"
          }`}
        >
          {isDevMode ? "🧠 Neural Trace: ACTIVE" : "Neural Trace: OFF"}
        </button>
      </div>

      {/* HERO BANNER CONTENT */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[45vh] text-center px-4 pt-20 pb-10">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter text-slate-900 mb-4">
          AI-CA Enterprise
        </h1>
        <p className="text-slate-600 max-w-xl text-sm sm:text-base font-medium">
          Neuro-Symbolic Governance, ESG, Conversational Context & Treasury Optimization powered by autonomous intelligence.
        </p>
      </div>

      {/* DASHBOARD WORKSPACE */}
      <div className="relative z-10 max-w-5xl mx-auto w-full p-8 pb-24">
        
        {!result ? (
          <Card className="bg-white/90 border-slate-200 backdrop-blur-md shadow-xl">
            <Title className="text-slate-900">Document Ingestion</Title>
            <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-grow p-3 border-2 border-dashed border-slate-300 rounded-md bg-slate-50 w-full">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-600 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
              <div className="flex space-x-2 w-full md:w-auto">
                <Button onClick={() => handleUpload(false)} disabled={loading} className="w-full md:w-32 bg-slate-600 hover:bg-slate-700 border-none text-xs text-white">
                  Standard Audit
                </Button>
                <Button onClick={() => handleUpload(true)} disabled={loading} className="w-full md:w-32 bg-blue-600 hover:bg-blue-700 border-none text-xs text-white">
                  Agentic Workflow
                </Button>
              </div>
            </div>
            {loading && <Text className="mt-4 text-center text-blue-600 animate-pulse text-xs font-medium">Processing Telemetry...</Text>}
            {error && <div className="mt-4 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>}
          </Card>
        ) : (
          <div className="flex justify-between items-center bg-blue-50/90 border border-blue-200 backdrop-blur-md p-4 rounded-lg shadow-sm">
            <div>
              <Text className="text-xs text-blue-700 font-bold uppercase tracking-wider">Active Session Rendered</Text>
              <Title className="text-slate-900 text-lg">Viewing Audit: {result.vendor_name}</Title>
            </div>
            <Button onClick={clearSession} className="bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 shadow-sm text-xs">
              Clear & Start New Audit
            </Button>
          </div>
        )}

        {result && (
          <div className="animate-fade-in-up mt-6 space-y-6">
            <Card className="bg-white/95 border-slate-200 backdrop-blur-md shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Title className="text-2xl text-slate-900">{result.vendor_name}</Title>
                  <Text className="text-xs font-semibold text-slate-500 mt-1">RBAC Status: {result.status}</Text>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <Badge color={getApprovalBadgeColor(result.approval_state)} size="xl">
                    {result.approval_state}
                  </Badge>
                  <button 
                    onClick={handleDownloadCertificate}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1 font-medium"
                  >
                    <span>Download Enterprise PDF</span>
                  </button>
                </div>
              </div>
              <Divider />

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Financial Ledger</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Reported Total</Text>
                    <Text className="font-mono font-medium text-slate-900">{getCurrencySymbol(result.currency)}{result.reported_total.toFixed(2)}</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Engine Total</Text>
                    <Text className="font-mono font-medium text-slate-900">{getCurrencySymbol(result.currency)}{result.calculated_total.toFixed(2)}</Text>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">AML Fraud Radar</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Threat Index</Text>
                    <Badge color={getRiskBadgeColor(result.risk_score)}>{result.risk_score} / 100</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">ERP PO Match</Text>
                    <Badge color={result.po_status === "PO_APPROVED" ? "emerald" : "orange"}>{result.po_status}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3 bg-emerald-50/70 p-4 rounded-lg border border-emerald-200">
                  <Text className="font-bold text-emerald-900 uppercase tracking-wide text-xs">ESG Scope 3 Carbon Accounting</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-emerald-700">Total Estimated CO2e</Text>
                    <Text className="font-mono font-bold text-emerald-950">{result.esg_metrics.total_co2} kg</Text>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-700">
                    <span>Hardware: {result.esg_metrics.hardware_co2}kg</span>
                    <span>Cloud: {result.esg_metrics.cloud_co2}kg</span>
                    <span>Travel: {result.esg_metrics.travel_co2}kg</span>
                  </div>
                </div>

                <div className="space-y-3 bg-blue-50/70 p-4 rounded-lg border border-blue-200">
                  <Text className="font-bold text-blue-900 uppercase tracking-wide text-xs">Temporal Accrual Engine</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-blue-700">Cadence Status</Text>
                    <Badge color={result.temporal_accrual.eom_liability_flag ? "orange" : "emerald"}>
                      {result.temporal_accrual.accrual_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs text-blue-700">
                    <span>Billing Cycle: {result.temporal_accrual.billing_cadence_days} Days</span>
                    <span>Next: {result.temporal_accrual.projected_next_billing}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-purple-50/70 p-4 rounded-lg border border-purple-200 mb-6">
                <Text className="font-bold text-purple-900 uppercase tracking-wide text-xs">Treasury Yield Optimizer</Text>
                <div className="flex justify-between items-center">
                  <Text className="text-purple-700">Recommended Action Plan</Text>
                  <Badge color="purple">{result.treasury_optimization.recommendation}</Badge>
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-purple-800 font-medium">
                  <span>Vendor Discount Terms: {result.treasury_optimization.discount_offered}</span>
                  <span>Projected Net Benefit: {getCurrencySymbol(result.currency)}{result.treasury_optimization.projected_net_benefit.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Policy Compliance</Text>
                {result.policy_violations.length > 0 ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <ul className="list-disc pl-5 space-y-1 text-sm text-red-700 font-medium">
                      {result.policy_violations.map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-md text-sm border border-emerald-200 font-medium">
                    ✓ Clean Audit: Zero policy or ESG violations detected.
                  </div>
                )}
              </div>

              <Divider />
              <div className="space-y-3">
                <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Conversational Document Intelligence</Text>
                <div className="p-4 bg-slate-900 rounded-xl space-y-3 shadow-inner">
                  <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-black/60 rounded border border-slate-800">
                    {chatLog.map((msg, i) => (
                      <div key={i} className={`text-xs p-2 rounded ${msg.sender === "AI" ? "bg-slate-800 text-slate-200 border border-slate-700" : "bg-blue-900/70 text-blue-100 text-right border border-blue-800"}`}>
                        <span className="font-bold">{msg.sender}:</span> {msg.text}
                      </div>
                    ))}
                    {chatLoading && <div className="text-xs text-emerald-400 animate-pulse p-1">Gemini is analyzing document context...</div>}
                  </div>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Ask a question about this invoice (e.g., 'What are the line items?')"
                      className="w-full text-xs p-2 rounded bg-slate-800 text-white border border-slate-700 focus:outline-none focus:border-blue-500"
                      value={chatQuestion}
                      onChange={(e) => setChatQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    />
                    <Button onClick={handleSendChat} size="xs" className="bg-blue-600 hover:bg-blue-700 border-none text-white">Send</Button>
                  </div>
                </div>
              </div>

              {result.payment_strategy !== "N/A" && (
                <>
                  <Divider />
                  <div className="space-y-4">
                    <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Autonomous Agent Actions</Text>
                    <div className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <Text className="font-bold text-blue-900">Agent Applied Strategy</Text>
                      <Badge color="blue">{result.payment_strategy.replace(/_/g, " ")}</Badge>
                    </div>

                    {result.vendor_email_draft !== "N/A" && (
                      <div className="mt-4 p-4 bg-slate-900 rounded-md shadow-inner relative border border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                            <Text className="font-bold text-slate-100 text-xs tracking-wider uppercase">Remediation Draft</Text>
                          </div>
                          <button 
                            onClick={() => handleReadAloud(result.vendor_email_draft)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded border border-slate-700"
                          >
                            <span>▶ Listen</span>
                          </button>
                        </div>
                        <Text className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                          {result.vendor_email_draft}
                        </Text>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Divider />
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Immutable Block Ledger & Git-Style Rollback</Text>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Rollback Reason..."
                      className="text-xs p-1 rounded bg-white text-slate-900 border border-slate-300 w-40"
                      value={rollbackReason}
                      onChange={(e) => setRollbackReason(e.target.value)}
                    />
                    <Button onClick={handleRollback} size="xs" className="bg-red-600 hover:bg-red-700 border-none text-[10px] text-white">
                      Execute Rollback
                    </Button>
                  </div>
                </div>
                {rollbackMsg && <Text className="text-xs text-emerald-700 font-medium">{rollbackMsg}</Text>}

                <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 p-6 bg-slate-100 rounded-xl border border-slate-200">
                  <div className="w-full md:w-5/12 bg-white border-2 border-dashed border-slate-300 rounded-lg p-3 text-center">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase">Block N-1</Text>
                    <div className="bg-slate-50 p-2 rounded mt-1">
                      <Text className="font-mono text-xs text-slate-600 truncate">{result.prev_hash}</Text>
                    </div>
                  </div>
                  <div className="w-full md:w-5/12 bg-white border-2 border-emerald-500 rounded-lg p-3 text-center relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                    <Text className="text-[10px] font-bold text-emerald-700 uppercase mt-1">Block N (Sealed)</Text>
                    <div className="bg-emerald-50/50 p-2 rounded mt-1">
                      <Text className="font-mono text-xs text-slate-900 truncate">{result.block_hash}</Text>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {isDevMode && (
              <Card className="bg-slate-900 border-slate-800 animate-fade-in-up">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <Title className="text-slate-200 text-sm tracking-widest uppercase">Raw Telemetry & Treasury Payload</Title>
                </div>
                <Divider className="border-slate-800" />
                <div className="bg-black p-4 rounded text-xs text-emerald-400 font-mono overflow-x-auto shadow-inner">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}