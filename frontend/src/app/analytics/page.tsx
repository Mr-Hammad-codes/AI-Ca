"use client";

import { Card, Title, Text, LineChart, DonutChart } from "@tremor/react";
import { useAudit } from "../context";

export default function AnalyticsPage() {
  const { history } = useAudit();

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
    <main className="min-h-screen p-8 bg-slate-50 flex justify-center">
      <div className="max-w-5xl w-full space-y-6 mt-8">
        <div className="mb-8">
          <Title className="text-3xl font-bold text-slate-900">Session Telemetry</Title>
          <Text className="text-slate-500">Real-time risk trends & execution distribution across all active instances.</Text>
        </div>

        <Card>
          {history.length === 0 ? (
            <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 rounded">
              <Text className="text-slate-400 text-sm">Awaiting first telemetry block...</Text>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <Text className="text-sm font-bold mb-4">Risk Trend Analysis</Text>
                <LineChart
                  className="h-72"
                  data={riskChartData}
                  index="name"
                  categories={["Risk Score"]}
                  colors={["red"]}
                  yAxisWidth={30}
                  curveType="monotone"
                />
              </div>
              <div>
                <Text className="text-sm font-bold mb-4">Execution States</Text>
                <DonutChart
                  className="h-72"
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
    </main>
  );
}