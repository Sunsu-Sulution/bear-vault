"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChartRenderer } from "@/components/chart-renderer";
import { ChartConfig, ChartType } from "@/types/chart";
import {
  Sparkles,
  RefreshCcw,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";

type GeminiChartSuggestion = {
  type: ChartType;
  title?: string;
  xAxisKey?: string;
  yAxisKey?: string;
  seriesKey?: string;
  groupByKey?: string;
  aggregate?: "sum" | "count" | "avg";
  columns?: string[];
};

interface GeminiResponse {
  sql: string;
  columns: string[];
  connectionId: string;
  database: string;
  originalQuestion: string;
  chartType?: SelectableChartType;
  chartSuggestions: GeminiChartSuggestion[];
  chartSummaries?: string[];
}

interface AiChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId: string;
  pagePath: string;
  onFetchSQLRows: (
    connectionId: string,
    database: string,
    sql: string,
    useLimit?: boolean,
  ) => Promise<Record<string, unknown>[] | undefined>;
}

interface PreviewState {
  configs: ChartConfig[];
  suggestionMap: Record<string, GeminiChartSuggestion>;
  data: Record<string, Record<string, unknown>[]>;
  availableFields: string[];
}

type SelectableChartType = "table" | "bar" | "line" | "pie" | "matrix";

const CHART_TYPE_OPTIONS: Array<{
  type: SelectableChartType;
  label: string;
  helper: string;
}> = [
  {
    type: "table",
    label: "ตาราง",
    helper: "แสดงผลลัพธ์แบบเต็ม เหมาะสำหรับการตรวจสอบข้อมูลโดยตรง",
  },
  {
    type: "bar",
    label: "กราฟแท่ง",
    helper: "เปรียบเทียบค่าระหว่างหมวดหมู่ เช่น ยอดขายตามสาขา",
  },
  {
    type: "line",
    label: "กราฟเส้น",
    helper: "ดูแนวโน้มตามเวลา เช่น รายได้รายวันหรือรายเดือน",
  },
  {
    type: "pie",
    label: "กราฟวงกลม",
    helper: "ดูสัดส่วนของหมวดหมู่ เช่น สัดส่วนยอดขายต่อประเภทสินค้า",
  },
  {
    type: "matrix",
    label: "Metric",
    helper: "โชว์ตัวเลขสำคัญจากผลลัพธ์เพียงแถวเดียว เช่นยอดรวมวันนี้",
  },
];

const buildPreviewState = (
  response: GeminiResponse,
  rows: Record<string, unknown>[],
  targetType: SelectableChartType,
): PreviewState => {
  const normalizedColumns = Array.isArray(response.columns)
    ? response.columns
        .map((col) => (typeof col === "string" ? col : String(col ?? "")))
        .filter((col) => col.trim().length > 0)
    : [];

  const baseDataMap: Record<string, Record<string, unknown>[]> = {};
  const suggestionMap: Record<string, GeminiChartSuggestion> = {};

  const configs: ChartConfig[] = [];

  const suggestions = Array.isArray(response.chartSuggestions)
    ? response.chartSuggestions
    : [];

  const idBase = `ai_preview_${Date.now()}`;

  const chooseSuggestion = (
    type: SelectableChartType,
  ): GeminiChartSuggestion | undefined => {
    return suggestions.find((suggestion) => suggestion?.type === type);
  };

  const pushConfig = (
    config: ChartConfig,
    suggestion: GeminiChartSuggestion,
  ) => {
    configs.push(config);
    baseDataMap[config.id] = rows;
    suggestionMap[config.id] = suggestion;
  };

  const makeTableConfig = (suggestion?: GeminiChartSuggestion): ChartConfig => {
    const tableId = `${idBase}_table`;
    return {
      id: tableId,
      title:
        suggestion?.title ||
        response.chartSummaries?.[0] ||
        "AI Preview (Table)",
      type: "table",
      height: 520,
      connectionId: response.connectionId,
      database: response.database,
      sqlQuery: response.sql,
      columns:
        normalizedColumns.length > 0
          ? normalizedColumns
          : rows.length > 0
          ? Object.keys(rows[0] as Record<string, unknown>)
          : [],
      aiGenerated: true,
    };
  };

  let suggestion: GeminiChartSuggestion | undefined;

  if (targetType === "table") {
    suggestion =
      chooseSuggestion("table") ??
      ({
        type: "table",
        title: response.chartSummaries?.[0] ?? "AI Preview (Table)",
        columns:
          normalizedColumns.length > 0
            ? normalizedColumns
            : rows.length > 0
            ? Object.keys(rows[0] as Record<string, unknown>)
            : [],
      } as GeminiChartSuggestion);
    const config = makeTableConfig(suggestion);
    if (!suggestion.columns || suggestion.columns.length === 0) {
      suggestion = {
        ...suggestion,
        columns: config.columns,
      };
    }
    pushConfig(config, suggestion);
  } else if (targetType === "matrix") {
    suggestion = chooseSuggestion("matrix");
    if (suggestion && suggestion.columns?.length) {
      const id = `${idBase}_matrix`;
      const config: ChartConfig = {
        id,
        title: suggestion.title || "AI Metric",
        type: "matrix",
        height: 320,
        connectionId: response.connectionId,
        database: response.database,
        sqlQuery: response.sql,
        columns: suggestion.columns,
        aiGenerated: true,
      };
      pushConfig(config, suggestion);
    }
  } else {
    suggestion = chooseSuggestion(targetType);
    if (
      suggestion &&
      suggestion.xAxisKey &&
      suggestion.yAxisKey &&
      rows.length > 0
    ) {
      const chartColumns =
        normalizedColumns.length > 0
          ? normalizedColumns
          : Array.from(
              new Set(
                [
                  suggestion.xAxisKey,
                  suggestion.yAxisKey,
                  suggestion.seriesKey,
                  suggestion.groupByKey,
                ].filter(Boolean) as string[],
              ),
            );
      const id = `${idBase}_${targetType}`;
      const config: ChartConfig = {
        id,
        title: suggestion.title || "AI Chart",
        type: suggestion.type,
        height: 480,
        connectionId: response.connectionId,
        database: response.database,
        sqlQuery: response.sql,
        columns: chartColumns,
        xAxisKey: suggestion.xAxisKey,
        yAxisKey: suggestion.yAxisKey,
        seriesKey: suggestion.seriesKey,
        groupByKey: suggestion.groupByKey,
        aggregate: suggestion.aggregate || "sum",
        sortBy: suggestion.yAxisKey,
        sortOrder: "desc",
        aiGenerated: true,
      };
      pushConfig(config, suggestion);
    }
  }

  // Fallback to table preview if we couldn't construct the requested chart
  if (configs.length === 0 && targetType === "table") {
    const tableSuggestion = chooseSuggestion("table");
    const fallbackConfig = makeTableConfig(tableSuggestion);
    const fallbackSuggestion: GeminiChartSuggestion = tableSuggestion
      ? {
          ...tableSuggestion,
          columns:
            tableSuggestion.columns && tableSuggestion.columns.length > 0
              ? tableSuggestion.columns
              : fallbackConfig.columns,
        }
      : {
          type: "table",
          title: fallbackConfig.title,
          columns: fallbackConfig.columns,
        };
    pushConfig(fallbackConfig, fallbackSuggestion);
  }

  const availableFields =
    rows.length > 0
      ? Object.keys(rows[0] as Record<string, unknown>)
      : normalizedColumns;

  return {
    configs,
    suggestionMap,
    data: baseDataMap,
    availableFields,
  };
};

export function AiChartDialog({
  open,
  onOpenChange,
  tabId,
  pagePath,
  onFetchSQLRows,
}: AiChartDialogProps) {
  const [question, setQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geminiResult, setGeminiResult] = useState<GeminiResponse | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [selectedType, setSelectedType] =
    useState<SelectableChartType>("table");

  useEffect(() => {
    if (!open) {
      setQuestion("");
      setIsGenerating(false);
      setIsAppending(false);
      setError(null);
      setGeminiResult(null);
      setPreview(null);
      setSelectedType("table");
    }
  }, [open]);

  const visibleConfigs = useMemo(() => {
    if (!preview) return [];
    return preview.configs.filter((config) => config.type === selectedType);
  }, [preview, selectedType]);

  const toggleType = (type: SelectableChartType) => {
    setSelectedType(type);
  };

  const handleGenerate = async () => {
    if (!question.trim()) {
      setError("กรุณาพิมพ์สิ่งที่ต้องการให้ AI สร้างกราฟ");
      return;
    }
    try {
      setIsGenerating(true);
      setError(null);
      setGeminiResult(null);
      setPreview(null);

      const response = await fetch("/api/chat/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          chartType: selectedType,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "ไม่สามารถสร้างกราฟจาก AI ได้");
      }

      const data = (await response.json()) as GeminiResponse;
      setGeminiResult(data);

      const rows =
        (await onFetchSQLRows(
          data.connectionId,
          data.database,
          data.sql,
          true,
        )) ?? [];

      if (!rows.length) {
        setError("AI ไม่พบข้อมูลที่สามารถนำมาสร้างกราฟได้");
      }

      const effectiveType = data.chartType ?? selectedType;
      const previewState = buildPreviewState(data, rows, effectiveType);
      setPreview(previewState);
      if (!previewState.configs.length) {
        setError("AI ไม่สามารถสร้างกราฟสำหรับประเภทที่เลือกได้");
      }
      const firstConfigType = previewState.configs[0]?.type as
        | SelectableChartType
        | undefined;
      const nextType =
        (data.chartType as SelectableChartType | undefined) ?? firstConfigType;
      if (nextType && nextType !== selectedType) {
        setSelectedType(nextType);
      }
    } catch (err) {
      console.error("AI chart preview error:", err);
      setError(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดขณะสร้างกราฟจาก AI",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAppend = async () => {
    if (!geminiResult || !preview) return;
    if (!preview.configs.length) {
      setError("ยังไม่มีกราฟให้เพิ่ม โปรดกดสร้างตัวอย่างก่อน");
      return;
    }
    const selectedConfig = visibleConfigs[0] ?? preview.configs[0];
    const selectedSuggestion = preview.suggestionMap[selectedConfig.id];
    if (!selectedSuggestion) {
      setError("ไม่พบข้อมูลกราฟที่สร้างจาก AI");
      return;
    }
    try {
      setIsAppending(true);
      setError(null);

      const response = await fetch("/api/chat/generate-dashboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentTabId: tabId,
          mode: "append",
          sql: geminiResult.sql,
          columns: geminiResult.columns,
          connectionId: geminiResult.connectionId,
          database: geminiResult.database,
          question: question.trim(),
          chartSuggestions: [selectedSuggestion],
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "ไม่สามารถเพิ่มกราฟจาก AI ได้");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("charts:refresh", {
            detail: { pagePath },
          }),
        );
      }

      onOpenChange(false);
    } catch (err) {
      console.error("Append AI charts error:", err);
      setError(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดขณะเพิ่มกราฟจาก AI",
      );
    } finally {
      setIsAppending(false);
    }
  };

  const questionPlaceholder =
    'เช่น "สรุปยอดขายรายวัน แสดง Top 5 สาขา" หรือ "ดูเทรนด์ยอดซื้อรายเดือน"';

  const canAppend = Boolean(visibleConfigs.length) && !isGenerating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สร้างกราฟด้วย AI</DialogTitle>
          <DialogDescription>
            พิมพ์สิ่งที่ต้องการให้ AI วิเคราะห์
            ระบบจะสร้างกราฟตัวอย่างให้ตรวจสอบก่อนเพิ่มลงในแท็บนี้
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3 rounded-2xl border bg-card/60 p-5 shadow-sm">
            <label className="text-sm font-semibold text-foreground">
              สิ่งที่อยากให้ AI ช่วยสร้าง
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {CHART_TYPE_OPTIONS.map((option) => {
                const isActive = selectedType === option.type;
                return (
                  <Button
                    key={option.type}
                    type="button"
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => toggleType(option.type)}
                    disabled={isGenerating || isAppending}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {
                CHART_TYPE_OPTIONS.find(
                  (option) => option.type === selectedType,
                )?.helper
              }
            </p>
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={questionPlaceholder}
              rows={3}
              className="w-full resize-none"
              disabled={isGenerating || isAppending}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || isAppending}
                className="inline-flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    สร้างตัวอย่าง
                  </>
                )}
              </Button>
              {preview && !isGenerating && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isAppending}
                  className="inline-flex items-center gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  สร้างใหม่
                </Button>
              )}
              {preview && (
                <div className="text-xs text-muted-foreground">
                  AI สร้างกราฟจากคำถามของคุณ
                  สามารถกดสร้างใหม่เพื่อสุ่มรูปแบบอื่นได้
                </div>
              )}
            </div>
            {geminiResult?.chartSummaries &&
              geminiResult.chartSummaries.length > 0 && (
                <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  <div className="mb-2 font-semibold text-foreground">
                    AI จะสร้างกราฟเหล่านี้
                  </div>
                  <ul className="space-y-1 list-disc pl-5">
                    {geminiResult.chartSummaries.map((summary, idx) => (
                      <li key={idx}>{summary}</li>
                    ))}
                  </ul>
                </div>
              )}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {preview && (
            <div className="space-y-4 rounded-2xl border bg-card/60 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  ตัวอย่างกราฟที่ AI สร้างจากคำถามนี้
                </h3>
              </div>
              {visibleConfigs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  ไม่มีกราฟที่ตรงกับประเภทที่เลือก
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleConfigs.map((config) => (
                    <div
                      key={config.id}
                      className="rounded-xl border border-primary/40 bg-background/80 p-4 shadow-[0_8px_32px_-20px_rgba(59,130,246,0.65)]"
                    >
                      <div className="mb-3 text-sm font-semibold text-foreground">
                        {config.title}
                      </div>
                      <ChartRenderer
                        config={config}
                        data={preview.data[config.id] ?? []}
                        availableFields={preview.availableFields}
                        isLoading={isGenerating}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            เมื่อกดเพิ่มกราฟ ระบบจะนำกราฟจาก AI ไปต่อท้ายแท็บปัจจุบันทันที
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isAppending}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleAppend}
              disabled={!canAppend || isAppending}
              className="inline-flex items-center gap-2"
            >
              {isAppending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังเพิ่มกราฟ...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  เพิ่มกราฟจาก AI
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
