"use client";

import { useState } from "react";
import { Card, Title, Text, Button, Divider, Badge } from "@tremor/react";

interface AuditRecord {
  vendor_name: string;
  currency?: string;
  reported_total: number;
  calculated_total: number;
  tax_amount: number;
  is_compliant: boolean;
  status: string;
  po_status: string;
  carbon_footprint_kg: number;
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
  const [customPolicy, setCustomPolicy] = useState<string>(""); // Live RAG State
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AuditRecord | null>(null);
  const [error, setError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
      setResult(null);
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
    formData.append("custom_policy", customPolicy); // Injecting the Live RAG data

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
      setResult(data.audit_record);
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

  // --- NATIVE VOICE EXECUTION MODULE ---
  const handleReadAloud = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech so it doesn't overlap
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; 
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech is not supported in this browser.");
    }
  };

  return (
    <main className="min-h-screen p-8 flex items-center justify-center bg-slate-50">
      <div className="max-w-4xl w-full space-y-6">
        <div className="text-center">
          <Title className="text-3xl font-bold text-slate-900">AI-CA Trade Audit Engine</Title>
          <Text className="text-slate-500">Live RAG & Neuro-Symbolic Governance</Text>
        </div>

        <Card>
          <Title>Document Verification Portal</Title>
          <Text>Upload invoices and inject dynamic corporate policies on the fly.</Text>
          
          <div className="mt-6 flex flex-col space-y-4">
            {/* File Upload Zone */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-md bg-white">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            {/* Live RAG Injection Zone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Live Policy Overrides (Optional)</label>
              <textarea 
                rows={2}
                placeholder="e.g., 'All Dell laptops are strictly prohibited' or 'Max shipping cost is ₹500'"
                className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border"
                value={customPolicy}
                onChange={(e) => setCustomPolicy(e.target.value)}
              />
              <Text className="text-xs text-slate-400 mt-1">This text will dynamically override the static corporate_policy.md file.</Text>
            </div>

            <div className="flex space-x-4 pt-2">
              <Button onClick={() => handleUpload(false)} disabled={loading} className="w-full bg-slate-600 hover:bg-slate-700 border-none">
                Standard Security Audit
              </Button>
              <Button onClick={() => handleUpload(true)} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 border-none">
                Agentic Audit (Phase 4)
              </Button>
            </div>
          </div>
          {loading && <Text className="mt-4 text-center text-blue-600 animate-pulse font-medium">Executing Neuro-Symbolic Processing...</Text>}
          {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm font-medium">{error}</div>}
        </Card>

        {result && (
          <div className="space-y-6 animate-fade-in-up">
            <Card>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <Title className="text-2xl">{result.vendor_name}</Title>
                  <Text className="text-xs font-semibold text-slate-500 mt-1">RBAC Status: {result.status}</Text>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge color={getApprovalBadgeColor(result.approval_state)} size="xl">
                    {result.approval_state}
                  </Badge>
                </div>
              </div>
              <Divider />

              {/* Grid 1: Ledger & Governance */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Financial Ledger</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Reported Total</Text>
                    <Text className="font-mono font-medium">{getCurrencySymbol(result.currency)}{result.reported_total.toFixed(2)}</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Math Engine Total</Text>
                    <Text className="font-mono font-medium">{getCurrencySymbol(result.currency)}{result.calculated_total.toFixed(2)}</Text>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">AML Fraud Radar</Text>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">Threat Index</Text>
                    <Badge color={getRiskBadgeColor(result.risk_score)}>
                      {result.risk_score} / 100
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text className="text-slate-600">ERP PO Authorization</Text>
                    <Badge color={result.po_status === "PO_APPROVED" ? "emerald" : "orange"}>{result.po_status}</Badge>
                  </div>
                </div>
              </div>

              {/* RAG Policy Violations */}
              <div className="space-y-2 mb-6">
                <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Corporate Policy Compliance</Text>
                {result.policy_violations.length > 0 ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <ul className="list-disc pl-5 space-y-1 text-sm text-red-700 font-medium">
                      {result.policy_violations.map((violation, idx) => (
                        <li key={idx}>{violation}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-md text-sm border border-emerald-200 font-medium">
                    ✓ Clean Audit: Zero procurement policy violations.
                  </div>
                )}
              </div>

              {/* Phase 4: Autonomous Actions conditionally rendered */}
              {result.payment_strategy !== "N/A" && (
                <>
                  <Divider />
                  <div className="space-y-4">
                    <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Autonomous Agent Actions</Text>
                    
                    <div className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <Text className="font-bold text-blue-900">Predicted Cash Flow Strategy</Text>
                      <Badge color="blue">{result.payment_strategy.replace(/_/g, " ")}</Badge>
                    </div>

                    {result.vendor_email_draft !== "N/A" && (
                      <div className="mt-4 p-4 bg-slate-900 rounded-md shadow-inner relative">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                            <Text className="font-bold text-slate-100 text-xs tracking-wider uppercase">Auto-Remediation Email Drafted</Text>
                          </div>
                          {/* NEW: Voice Execution Button */}
                          <button 
                            onClick={() => handleReadAloud(result.vendor_email_draft)}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1 rounded border border-slate-500 transition-colors flex items-center space-x-1"
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

              {/* ENHANCED: Cryptographic Hash-Chain Ledger Visualizer */}
              <Divider />
              <div className="space-y-4">
                <Text className="font-bold text-slate-900 uppercase tracking-wide text-xs">Immutable Block Ledger</Text>
                
                <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6 p-6 bg-slate-100 rounded-xl border border-slate-200 shadow-inner overflow-hidden">
                  
                  {/* Block N-1 (Previous) */}
                  <div className="flex flex-col items-center space-y-2 w-full md:w-5/12 opacity-75">
                    <div className="w-full bg-white border-2 border-dashed border-slate-300 rounded-lg p-3 text-center shadow-sm relative">
                      <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Block N-1</Text>
                      <div className="bg-slate-50 p-2 rounded border border-slate-100 overflow-hidden">
                        <Text className="font-mono text-xs text-slate-500 truncate">{result.prev_hash}</Text>
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Link (Arrow) */}
                  <div className="flex flex-col items-center justify-center hidden md:flex">
                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center justify-center md:hidden">
                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Block N (Current) */}
                  <div className="flex flex-col items-center space-y-2 w-full md:w-5/12">
                    <div className="w-full bg-white border-2 border-emerald-400 rounded-lg p-3 text-center shadow-md relative overflow-hidden">
                      {/* Decorative accent */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                      
                      <Text className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 mt-1">Block N (Verified)</Text>
                      <div className="bg-emerald-50 p-2 rounded border border-emerald-100 overflow-hidden">
                        <Text className="font-mono text-xs text-slate-800 truncate">{result.block_hash}</Text>
                      </div>
                      <div className="mt-2 flex justify-between px-1">
                        <Text className="text-[9px] text-slate-400">Tx: {result.vendor_name.substring(0,10)}...</Text>
                        <Text className="text-[9px] text-slate-400">Risk: {result.risk_score}</Text>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </Card>
          </div>
        )}
      </div>
    </main>
  );
}