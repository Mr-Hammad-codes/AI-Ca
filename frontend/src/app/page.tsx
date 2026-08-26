"use client";

import { useState } from "react";
import { Card, Title, Text, Button, Divider, Badge, LineChart, DonutChart } from "@tremor/react";
import jsPDF from "jspdf";

interface ESGMetrics {
  hardware_co2: number;
  travel_co2: number;
  cloud_co2: number;
  logistics_co2: number;
  total_co2: number;
}

interface TemporalAccrual {
  billing_cadence_days: number;
  accrual_status: string;
  projected_next_billing: string;
  eom_liability_flag: boolean;
}

interface AuditRecord {
  vendor_name: string;
  currency?: string;
  reported_total: number;
  calculated_total: number;
  tax_amount: number;
  is_compliant: boolean;
  status: string;
  po_status: string;
  esg_metrics: ESGMetrics;
  temporal_accrual: TemporalAccrual;
  policy_violations: string[];
  risk_score: number;
  fraud_flags: string[];
  approval_state: string;
  prev_hash: string;
  block_hash: string;
  payment_strategy: string;
  vendor_email_draft: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [customPolicy, setCustomPolicy] = useState<string>(""); 
  const [loading, setLoading] = useState<boolean>(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  
  const [result, setResult] = useState<AuditRecord | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [error, setError] = useState<string>("");

  // Chat State
  const [chatQuestion, setChatQuestion] = useState<string>("");
  const [chatLog, setChatLog] = useState<{ sender: string; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Rollback State
  const [rollbackReason, setRollbackReason] = useState<string>("");
  const [rollbackMsg, setRollbackMsg] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
      setChatLog([]);
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
      setHistory((prev) => [...prev, newRecord]);
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
    setChatLog((prev) => [...prev, { sender: "User", text: userQ }]);
    setChatLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat-invoice/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQ, vendor_name: result.vendor_name }),
      });
      const data = await res.json();
      setChatLog((prev) => [...prev, { sender: "AI", text: data.answer }]);
    } catch {
      setChatLog((prev) => [...prev, { sender: "AI", text: "Error connecting to conversational context engine." }]);
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
    doc.text("--- FINANCIAL & ESG METRICS ---", 20, 56);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(`Reported Total: ${result.currency} ${result.reported_total.toFixed(2)}`, 20, 64);
    doc.text(`Calculated Engine: ${result.currency} ${result.calculated_total.toFixed(2)}`, 20, 70);
    doc.text(`Scope 3 Carbon Footprint: ${result.esg_metrics.total_co2} kg CO2e`, 20, 76);
    doc.text(`Temporal Accrual Status: ${result.temporal_accrual.accrual_status}`, 20, 82);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(6, 78, 59); 
    doc.text("--- CRYPTOGRAPHIC PROOF ---", 20, 96);
    doc.setFontSize(8);
    doc.setFont("courier", "normal"); 
    doc.setTextColor(71, 85, 105); 
    doc.text(`Prev Hash: ${result.prev_hash}`, 20, 104);
    doc.text(`Block Hash: ${result.block_hash}`, 20, 112);

    doc.save(`Enterprise_Audit_${result.vendor_name.replace(/\s+/g, '_')}.pdf`);
  };

  const riskChartData = history.map((rec, idx) => ({
    name: `T+${idx + 1}`,
    "Risk Score": rec.risk_score,
  }));

  const approvalCounts = history.reduce((acc, rec) => {
    acc[rec.approval_state] = (acc[rec.approval_state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const approvalChartData = Object.entries(approvalCounts).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <main className="min-h-screen p-8 bg-slate-50 flex justify-center relative">
      <div className="absolute top-6 right-8">
        <button
          onClick={() => setIsDevMode(!isDevMode)}
          className={`text-xs px-4 py-2 rounded-full border transition-all duration-300 font-medium ${
            isDevMode 
              ? "bg-slate-900 text-emerald-400 border-slate-700 shadow-inner" 
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100 shadow-sm"
          }`}
        >
          {isDevMode ? "🧠 Neural Trace: ACTIVE" : "Neural Trace: OFF"}
        </button>
      </div>

      <div className="max-w-5xl w-full space-y-6 mt-8">
        <div className="text-center mb-8">
          <Title className="text-3xl font-bold text-slate-900">AI-CA Enterprise Intelligence Engine</Title>
          <Text className="text-slate-500">Neuro-Symbolic Governance, ESG, Conversational Context & Rollbacks</Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <Title>Ingestion Portal</Title>
            <div className="mt-4 flex flex-col space-y-4">
              <div className="p-3 border-2 border-dashed border-slate-300 rounded-md bg-white">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Live Policy Override</label>
                <textarea 
                  rows={2}
                  className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 text-sm p-2 border"
                  value={customPolicy}
                  onChange={(e) => setCustomPolicy(e.target.value)}
                />
              </div>

              <div className="flex flex-col space-y-2 pt-2">
                <Button onClick={() => handleUpload(false)} disabled={loading} className="w-full bg-slate-600 hover:bg-slate-700 border-none text-xs">
                  Standard Audit
                </Button>
                <Button onClick={() => handleUpload(true)} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 border-none text-xs">
                  Agentic Workflow
                </Button>
              </div>
            </div>
            {loading && <Text className="mt-4 text-center text-blue-600 animate-pulse text-xs font-medium">Processing Telemetry...</Text>}
            {error && <div className="mt-4 p-2 bg-red-50 text-red-700 rounded text-xs">{error}</div>}
          </Card>

          <Card className="md:col-span-2">
            <Title>Session Telemetry</Title>
            <Text className="text-xs mb-4">Real-time risk trends & execution distribution.</Text>
            
            {history.length === 0 ? (
              <div className="h-48 flex items-center justify-center border border-dashed border-slate-200 rounded">
                <Text className="text-slate-400 text-sm">Awaiting first telemetry block...</Text>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Text className="text-xs font-bold mb-2">Risk Trend Analysis</Text>
                  <LineChart
                    className="h-48"
                    data={riskChartData}
                    index="name"
                    categories={["Risk Score"]}
                    colors={["red"]}
                    yAxisWidth={30}
                    showLegend={false}
                    curveType="monotone"
                  />
                </div>
                <div>
                  <Text className="text-xs font-bold mb-2">Execution States</Text>
                  <DonutChart
                    className="h-48"
                    data={approvalChartData}
                    category="value"
                    index="name"
                    colors={["emerald", "orange", "red"]}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>

        {result && (
          <div className="animate-fade-in-up space-y-6">
            <Card>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Title className="text-2xl">{result.vendor_name}</Title>
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

              {/* Grid 1: Financial & Fraud */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Financial Ledger</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Reported Total</Text>
                    <Text className="font-mono font-medium">{getCurrencySymbol(result.currency)}{result.reported_total.toFixed(2)}</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Engine Total</Text>
                    <Text className="font-mono font-medium">{getCurrencySymbol(result.currency)}{result.calculated_total.toFixed(2)}</Text>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
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

              {/* Grid 2: ESG Scope 3 & Temporal Accruals */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                  <Text className="font-bold text-emerald-900 uppercase tracking-wide text-xs">ESG Scope 3 Carbon Accounting</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-emerald-700">Total Estimated CO2e</Text>
                    <Text className="font-mono font-bold text-emerald-900">{result.esg_metrics.total_co2} kg</Text>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-600">
                    <span>Hardware: {result.esg_metrics.hardware_co2}kg</span>
                    <span>Cloud: {result.esg_metrics.cloud_co2}kg</span>
                    <span>Travel: {result.esg_metrics.travel_co2}kg</span>
                  </div>
                </div>

                <div className="space-y-3 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                  <Text className="font-bold text-blue-900 uppercase tracking-wide text-xs">Temporal Accrual Engine</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-blue-700">Cadence Status</Text>
                    <Badge color={result.temporal_accrual.eom_liability_flag ? "orange" : "emerald"}>
                      {result.temporal_accrual.accrual_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs text-blue-600">
                    <span>Billing Cycle: {result.temporal_accrual.billing_cadence_days} Days</span>
                    <span>Next: {result.temporal_accrual.projected_next_billing}</span>
                  </div>
                </div>
              </div>

              {/* Policy Violations */}
              <div className="space-y-2 mb-6">
                <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Policy Compliance</Text>
                {result.policy_violations.length > 0 ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <ul className="list-disc pl-5 space-y-1 text-sm text-red-700 font-medium">
                      {result.policy_violations.map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-md text-sm border border-emerald-200 font-medium">
                    ✓ Clean Audit: Zero policy or ESG violations detected.
                  </div>
                )}
              </div>

              {/* MODULE 3: CONVERSATIONAL DOCUMENT-CHAT UI */}
              <Divider />
              <div className="space-y-3">
                <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Conversational Document Intelligence</Text>
                <div className="p-4 bg-slate-900 rounded-xl space-y-3 shadow-inner">
                  <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-black/40 rounded border border-slate-800">
                    {chatLog.map((msg, i) => (
                      <div key={i} className={`text-xs p-2 rounded ${msg.sender === "AI" ? "bg-slate-800 text-slate-200" : "bg-blue-900/60 text-blue-200 text-right"}`}>
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
                    <Button onClick={handleSendChat} size="xs" className="bg-blue-600 hover:bg-blue-700 border-none">Send</Button>
                  </div>
                </div>
              </div>

              {/* Agent Actions */}
              {result.payment_strategy !== "N/A" && (
                <>
                  <Divider />
                  <div className="space-y-4">
                    <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Autonomous Agent Actions</Text>
                    <div className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <Text className="font-bold text-blue-900">Recommended Treasury Strategy</Text>
                      <Badge color="blue">{result.payment_strategy.replace(/_/g, " ")}</Badge>
                    </div>

                    {result.vendor_email_draft !== "N/A" && (
                      <div className="mt-4 p-4 bg-slate-900 rounded-md shadow-inner relative">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                            <Text className="font-bold text-slate-100 text-xs tracking-wider uppercase">Remediation Draft</Text>
                          </div>
                          <button 
                            onClick={() => handleReadAloud(result.vendor_email_draft)}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1 rounded border border-slate-500"
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

              {/* MODULE 4: LEDGER ROLLBACK & REVERSING ENTRIES */}
              <Divider />
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Immutable Block Ledger & Git-Style Rollback</Text>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Rollback Reason..."
                      className="text-xs p-1 rounded border border-slate-300 w-40"
                      value={rollbackReason}
                      onChange={(e) => setRollbackReason(e.target.value)}
                    />
                    <Button onClick={handleRollback} size="xs" className="bg-red-600 hover:bg-red-700 border-none text-[10px]">
                      Execute Rollback (Reversing Entry)
                    </Button>
                  </div>
                </div>
                {rollbackMsg && <Text className="text-xs text-emerald-600 font-medium">{rollbackMsg}</Text>}

                <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 p-6 bg-slate-100 rounded-xl border border-slate-200">
                  <div className="w-full md:w-5/12 bg-white border-2 border-dashed border-slate-300 rounded-lg p-3 text-center">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase">Block N-1</Text>
                    <div className="bg-slate-50 p-2 rounded mt-1">
                      <Text className="font-mono text-xs text-slate-500 truncate">{result.prev_hash}</Text>
                    </div>
                  </div>
                  <div className="w-full md:w-5/12 bg-white border-2 border-emerald-400 rounded-lg p-3 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                    <Text className="text-[10px] font-bold text-emerald-600 uppercase mt-1">Block N (Sealed)</Text>
                    <div className="bg-emerald-50 p-2 rounded mt-1">
                      <Text className="font-mono text-xs text-slate-800 truncate">{result.block_hash}</Text>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {isDevMode && (
              <Card className="bg-slate-900 border-slate-800 animate-fade-in-up">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <Title className="text-slate-200 text-sm tracking-widest uppercase">Raw Telemetry & ESG Payload</Title>
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