"use client";
import React, { useState } from "react";
import { useChartConfigs } from "@/hooks/use-chart-configs";
import { ChartConfigDialog } from "@/components/chart-config-dialog";
import { ChartRenderer } from "@/components/chart-renderer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ChartConfig } from "@/types/chart";

interface IRow {
  make: string;
  model: string;
  price: number;
  electric: boolean;
  [key: string]: unknown;
}

export default function Page() {
  const pagePath = "/dashboard/fraud-non-member";
  const { configs, isLoaded, addChart, updateChart, removeChart } =
    useChartConfigs(pagePath);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ChartConfig | undefined>();

  // ข้อมูลตัวอย่าง (ในอนาคตอาจจะดึงจาก API)
  const [rowData] = useState<IRow[]>([
    { make: "Tesla", model: "Model Y", price: 64950, electric: true },
    { make: "Ford", model: "F-Series", price: 33850, electric: false },
    { make: "Toyota", model: "Corolla", price: 29600, electric: false },
    { make: "Mercedes", model: "EQA", price: 48890, electric: true },
    { make: "Fiat", model: "500", price: 15774, electric: false },
    { make: "Nissan", model: "Juke", price: 20675, electric: false },
  ]);

  const availableFields = ["make", "model", "price", "electric"];

  const handleAddChart = () => {
    setEditingConfig(undefined);
    setIsDialogOpen(true);
  };

  const handleEditChart = (config: ChartConfig) => {
    setEditingConfig(config);
    setIsDialogOpen(true);
  };

  const handleSaveChart = (config: Omit<ChartConfig, "id">) => {
    if (editingConfig) {
      updateChart(editingConfig.id, config);
    } else {
      addChart(config);
    }
    setIsDialogOpen(false);
    setEditingConfig(undefined);
  };

  const handleDeleteChart = (id: string) => {
    if (confirm("คุณต้องการลบกราฟนี้หรือไม่?")) {
      removeChart(id);
    }
  };

  const handleExportConfig = () => {
    const payload = JSON.stringify({ charts: configs }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dashboard-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsedUnknown = JSON.parse(text) as unknown;
      const charts = (parsedUnknown as { charts?: unknown }).charts;
      if (Array.isArray(charts)) {
        charts.forEach((c) => {
          // basic shape guard
          if (c && typeof c === "object") {
            const cfg = c as Partial<ChartConfig>;
            const {
              title,
              type,
              height,
              columns,
              columnDefs,
              xAxisKey,
              yAxisKey,
            } = cfg;
            if (
              typeof title === "string" &&
              (type === "table" ||
                type === "bar" ||
                type === "line" ||
                type === "pie") &&
              typeof height === "number" &&
              Array.isArray(columns)
            ) {
              addChart({
                title,
                type,
                height,
                columns: columns as string[],
                columnDefs,
                xAxisKey,
                yAxisKey,
              });
            }
          }
        });
      }
    } catch (err) {
      console.error("Invalid dashboard config", err);
    } finally {
      e.currentTarget.value = "";
    }
  };

  if (!isLoaded) {
    return (
      <div className="p-5">
        <div className="text-2xl font-bold">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">Fraud Non Member</div>
        <div className="flex gap-2">
          <Button onClick={handleAddChart}>
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มกราฟ
          </Button>
          <Button variant="outline" onClick={handleExportConfig}>
            Export .json
          </Button>
          <Button variant="outline" onClick={handleImportClick}>
            Import .json
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">ยังไม่มีกราฟในหน้านี้</p>
          <Button onClick={handleAddChart} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มกราฟแรก
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {configs.map((config) => (
            <ChartRenderer
              key={config.id}
              config={config}
              data={rowData}
              onEdit={handleEditChart}
              onDelete={handleDeleteChart}
            />
          ))}
        </div>
      )}

      <ChartConfigDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        config={editingConfig}
        onSave={handleSaveChart}
        availableFields={availableFields}
      />
    </div>
  );
}
