"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface ESGMetrics {
  hardware_co2: number;
  travel_co2: number;
  cloud_co2: number;
  logistics_co2: number;
  total_co2: number;
}

export interface TemporalAccrual {
  billing_cadence_days: number;
  accrual_status: string;
  projected_next_billing: string;
  eom_liability_flag: boolean;
}

export interface TreasuryOptimization {
  recommendation: string;
  discount_offered: string;
  projected_net_benefit: number;
}

export interface AuditRecord {
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
  treasury_optimization: TreasuryOptimization;
  policy_violations: string[];
  risk_score: number;
  fraud_flags: string[];
  approval_state: string;
  prev_hash: string;
  block_hash: string;
  payment_strategy: string;
  vendor_email_draft: string;
}

export interface ChatMessage {
  sender: string;
  text: string;
}

interface AuditContextType {
  result: AuditRecord | null;
  setResult: (res: AuditRecord | null) => void;
  history: AuditRecord[];
  setHistory: (hist: AuditRecord[]) => void;
  customPolicy: string;
  setCustomPolicy: (policy: string) => void;
  chatLog: ChatMessage[];
  setChatLog: (log: ChatMessage[]) => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<AuditRecord | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [customPolicy, setCustomPolicy] = useState<string>("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);

  return (
    <AuditContext.Provider value={{ 
      result, setResult, 
      history, setHistory, 
      customPolicy, setCustomPolicy,
      chatLog, setChatLog 
    }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (!context) throw new Error("useAudit must be used within an AuditProvider");
  return context;
}