"use client";

import { Card, Title, Text, Button } from "@tremor/react";
import { useAudit } from "../context";
import { useState } from "react";

export default function SettingsPage() {
  const { customPolicy, setCustomPolicy } = useAudit();
  const [localPolicy, setLocalPolicy] = useState(customPolicy);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setCustomPolicy(localPolicy);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="min-h-screen p-8 bg-slate-50 flex justify-center">
      <div className="max-w-3xl w-full space-y-6 mt-8">
        <div className="mb-8">
          <Title className="text-3xl font-bold text-slate-900">Governance Policies</Title>
          <Text className="text-slate-500">Manage live overrides and RAG context rules.</Text>
        </div>

        <Card>
          <Title className="mb-4">Live Policy Override</Title>
          <Text className="text-xs text-slate-500 mb-4">
            Rules entered here are dynamically injected into the neuro-symbolic engine during standard and agentic audits.
          </Text>
          <textarea 
            rows={8}
            className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 text-sm p-3 border mb-4 font-mono"
            placeholder="e.g., Reject all software purchases over ₹50,000 without VP approval."
            value={localPolicy}
            onChange={(e) => setLocalPolicy(e.target.value)}
          />
          <div className="flex justify-end items-center space-x-4">
            {saved && <Text className="text-emerald-600 text-xs font-bold">✓ Policy Updated Globally</Text>}
            <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 border-none">
              Save Global Policy
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}