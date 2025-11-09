"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChartRenderer } from "@/components/chart-renderer";
import { ChartConfig } from "@/types/chart";
import { useIsMobile } from "@/hooks/use-mobile";

export default function PublicTabPage() {
  const params = useParams<{ tabId: string }>();
  const tabId = params.tabId as string;
  const isMobile = useIsMobile();
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartsData, setChartsData] = useState<Record<string, Record<string, unknown>[]>>({});
  const [chartsColumns, setChartsColumns] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTab = async () => {
      try {
        const response = await fetch(`/api/public/tab/${tabId}`);
        if (!response.ok) {
          throw new Error("Tab not found");
        }
        const result = await response.json();
        setCharts(result.charts || []);
        setChartsData(result.chartsData || {});
        setChartsColumns(result.chartsColumns || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tab");
      } finally {
        setLoading(false);
      }
    };

    if (tabId) {
      fetchTab();
    }
  }, [tabId]);

  // Calculate total width for layout
  const totalWidth = charts.reduce((sum, chart) => {
    return sum + (chart.width || 0);
  }, 0);

  const shouldUseNowrap = totalWidth === 0 || totalWidth <= 90;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">กำลังโหลด...</div>
      </div>
    );
  }

  if (error || charts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-destructive">{error || "ไม่พบกราฟ"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        </div>
        <div
          className={`flex flex-col md:flex-row items-start ${
            shouldUseNowrap ? "md:flex-nowrap md:gap-2" : "md:flex-wrap gap-4"
          }`}
        >
          {charts.map((chart) => {
            const hasWidth = chart.width !== undefined;

            return (
              <div
                key={chart.id}
                className={`w-full ${
                  isMobile
                    ? ""
                    : hasWidth
                    ? "md:w-auto md:shrink"
                    : shouldUseNowrap
                    ? "md:flex-1 md:min-w-0"
                    : "md:flex-1 md:max-w-[calc(50%-8px)] md:min-w-[300px]"
                }`}
                style={{
                  ...(isMobile
                    ? { width: "100%" }
                    : chart.width !== undefined
                    ? { width: `${chart.width}%` }
                    : {}),
                  maxWidth: "100%",
                  flexShrink: 1,
                }}
              >
                <ChartRenderer
                  config={chart}
                  data={chartsData[chart.id] || []}
                  isLoading={false}
                  availableFields={chartsColumns[chart.id] || []}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

