"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChartRenderer } from "@/components/chart-renderer";
import { ChartConfig } from "@/types/chart";

export default function PublicChartPage() {
  const params = useParams<{ chartId: string }>();
  const chartId = params.chartId as string;
  const [chart, setChart] = useState<ChartConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChart = async () => {
      setIsLoadingData(true);
      try {
        const response = await fetch(`/api/public/chart/${chartId}`);
        if (!response.ok) {
          throw new Error("Chart not found");
        }
        const result = await response.json();
        setChart(result.chart);
        setData(result.data || []);
        setColumns(result.columns || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chart");
      } finally {
        setLoading(false);
        setIsLoadingData(false);
      }
    };

    if (chartId) {
      fetchChart();
    }
  }, [chartId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">กำลังโหลด...</div>
      </div>
    );
  }

  if (error || !chart) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-destructive">{error || "ไม่พบกราฟ"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{chart.title}</h1>
          {chart.type === "markdown" && chart.markdownContent && (
            <p className="text-sm text-muted-foreground mt-1">
              Markdown Content
            </p>
          )}
        </div>
        <ChartRenderer
          config={chart}
          data={data}
          isLoading={isLoadingData}
          availableFields={columns}
        />
      </div>
    </div>
  );
}

