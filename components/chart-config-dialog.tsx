"use client";

import { useState, useEffect, useRef } from "react";
import { ChartConfig, ChartType } from "@/types/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColDef } from "ag-grid-community";
import { useConnections } from "@/hooks/use-connections";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  LineChart,
  PieChart,
  Table as TableIcon,
  Text,
  Sparkles,
  SlidersHorizontal,
  Columns3,
  X as XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ChartConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: ChartConfig;
  onSave: (config: Omit<ChartConfig, "id">) => void;
  availableFields?: string[];
  availableTables?: string[];
  onTableChange?: (table: string) => void;
}

type ChartTypeOption = {
  value: ChartType;
  label: string;
  description: string;
  icon: LucideIcon;
  highlight?: string;
};

const chartTypeOptions: ChartTypeOption[] = [
  {
    value: "table",
    label: "ตาราง",
    description: "แสดงข้อมูลดิบแบบเต็มพร้อมเลือกคอลัมน์",
    icon: TableIcon,
  },
  {
    value: "bar",
    label: "กราฟแท่ง",
    description: "เปรียบเทียบค่าแยกตามหมวดหมู่",
    icon: BarChart3,
  },
  {
    value: "line",
    label: "กราฟเส้น",
    description: "วิเคราะห์แนวโน้มหรือข้อมูลตามเวลา",
    icon: LineChart,
  },
  {
    value: "pie",
    label: "กราฟวงกลม",
    description: "ดูสัดส่วนของข้อมูลแบบรวม",
    icon: PieChart,
  },
  {
    value: "markdown",
    label: "Markdown Note",
    description: "จดบันทึก ข้อสรุป หรือ action item",
    icon: Text,
  },
];

const DROPDOWN_MENU_Z = "z-[500]";

export function ChartConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
  availableFields = [],
}: ChartConfigDialogProps) {
  const { connections } = useConnections();
  const [title, setTitle] = useState(config?.title ?? "");
  const [type, setType] = useState<ChartType>(config?.type ?? "table");
  const [height, setHeight] = useState(config?.height ?? 500);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    config?.columns ?? [],
  );
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [tableName, setTableName] = useState(config?.tableName ?? "");
  const [connectionId, setConnectionId] = useState(config?.connectionId ?? "");
  const [database, setDatabase] = useState(config?.database ?? "");
  const [tables, setTables] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [xAxisKey, setXAxisKey] = useState(config?.xAxisKey ?? "");
  const [yAxisKey, setYAxisKey] = useState(config?.yAxisKey ?? "");
  const [sortBy, setSortBy] = useState(config?.sortBy ?? "");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    config?.sortOrder ?? "asc",
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [seriesColor, setSeriesColor] = useState<string>(
    config?.color ?? "#f97316",
  );
  const [groupByKey, setGroupByKey] = useState(config?.groupByKey ?? "");
  const [seriesKey, setSeriesKey] = useState(config?.seriesKey ?? "");
  const [aggregate, setAggregate] = useState<"sum" | "count" | "avg">(
    config?.aggregate ?? "sum",
  );
  const [xAxisTitle, setXAxisTitle] = useState(config?.xAxisTitle ?? "");
  const [yAxisTitle, setYAxisTitle] = useState(config?.yAxisTitle ?? "");
  const [markdownContent, setMarkdownContent] = useState(
    config?.markdownContent ?? "",
  );

  const didPrefetchRef = useRef(false);

  const availableColumns = tableColumns.length ? tableColumns : availableFields;
  const isAxisChart = type === "bar" || type === "line" || type === "pie";
  const isMatrix = type === "matrix";
  const isMarkdown = type === "markdown";

  const sortCandidates = availableColumns
    .concat([xAxisKey, yAxisKey].filter(Boolean) as string[])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  useEffect(() => {
    if (!open) {
      didPrefetchRef.current = false;
      return;
    }
    if (didPrefetchRef.current) return;
    if (!connectionId || !database || !tableName) return;

    const c = connections.find((x) => x.id === connectionId);
    if (!c) return;
    didPrefetchRef.current = true;

    (async () => {
      try {
        const [dbsRes, tablesRes, colsRes] = await Promise.all([
          fetch("/api/db/tables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: c.host,
              port: c.port,
              user: c.user,
              password: c.password,
            }),
          }),
          fetch("/api/db/tables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: c.host,
              port: c.port,
              user: c.user,
              password: c.password,
              database,
            }),
          }),
          fetch("/api/db/columns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: c.type,
              host: c.host,
              port: c.port,
              user: c.user,
              password: c.password,
              database,
              table: tableName,
            }),
          }),
        ]);

        const [dbs, tbls, cols] = await Promise.all([
          dbsRes.json(),
          tablesRes.json(),
          colsRes.json(),
        ]);
        setDatabases(dbs.databases ?? []);
        setTables(tbls.tables ?? []);
        setTableColumns(
          (cols.columns ?? []).map((x: { name: string }) => x.name),
        );
      } catch {
        // no-op on background failure
      }
    })();
  }, [open, connectionId, database, tableName, connections]);

  const fetchDatabases = async () => {
    if (!connectionId) return;
    const c = connections.find((x) => x.id === connectionId);
    if (!c) return;
    const res = await fetch("/api/db/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: c.type,
        host: c.host,
        port: c.port,
        user: c.user,
        password: c.password,
      }),
    });
    const data = await res.json();
    setDatabases(data.databases ?? []);
  };

  const fetchTablesForDb = async (db: string) => {
    if (!connectionId || !db) return;
    const c = connections.find((x) => x.id === connectionId);
    if (!c) return;
    const res = await fetch("/api/db/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: c.type,
        host: c.host,
        port: c.port,
        user: c.user,
        password: c.password,
        database: db,
      }),
    });
    const data = await res.json();
    setTables(data.tables ?? []);
  };

  const handleSelectAllColumns = () => {
    if (!availableColumns.length) return;
    setSelectedColumns([...availableColumns]);
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  const handleToggleColumn = (field: string) => {
    if (selectedColumns.includes(field)) {
      setSelectedColumns(selectedColumns.filter((col) => col !== field));
      return;
    }

    if (isMatrix && selectedColumns.length >= 6) {
      // จำกัด Matrix ไม่เกิน 6 ค่าเพื่อความอ่านง่าย
      return;
    }

    setSelectedColumns([...selectedColumns, field]);
  };

  const handleSave = () => {
    if (isMarkdown) {
      if (!markdownContent.trim()) return;
      onSave({
        title: "",
        type,
        height: 500,
        columns: [],
        markdownContent: markdownContent.trim(),
        aiGenerated: config?.aiGenerated,
      });
      onOpenChange(false);
      return;
    }

    if (!title.trim()) return;
    if (!connectionId || !database || !tableName) return;

    if (type === "table" && selectedColumns.length === 0) return;
    if (isMatrix && selectedColumns.length === 0) return;

    if (isAxisChart && (!xAxisKey || !yAxisKey)) {
      return;
    }

    const columnDefs: ColDef[] = selectedColumns.map((col) => ({
      field: col,
      flex: 1,
    }));

    onSave({
      title: title.trim(),
      type,
      height,
      connectionId,
      database,
      tableName: tableName || undefined,
      columns: selectedColumns,
      columnDefs,
      xAxisKey: isAxisChart ? xAxisKey : undefined,
      yAxisKey: isAxisChart ? yAxisKey : undefined,
      groupByKey: isAxisChart ? groupByKey || xAxisKey || undefined : undefined,
      seriesKey: isAxisChart ? seriesKey || undefined : undefined,
      aggregate: isAxisChart ? aggregate : undefined,
      sortBy: isAxisChart && sortBy ? sortBy : undefined,
      sortOrder: isAxisChart && sortBy ? sortOrder : undefined,
      color: isAxisChart ? seriesColor : undefined,
      xAxisTitle: isAxisChart ? xAxisTitle || undefined : undefined,
      yAxisTitle: isAxisChart ? yAxisTitle || undefined : undefined,
      aiGenerated: config?.aiGenerated,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <div className="px-6 pt-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
              {config ? "แก้ไขการตั้งค่ากราฟ" : "เพิ่มกราฟใหม่"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              เลือกประเภทกราฟ กำหนดแหล่งข้อมูล
              และปรับแต่งรายละเอียดให้พร้อมใช้งาน
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chartTypeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = option.value === type;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setType(option.value)}
                  className={cn(
                    "relative flex h-full flex-col items-start rounded-2xl border bg-background/80 p-4 text-left transition-all",
                    "hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive ? "border-primary/70" : "border-border/70",
                  )}
                >
                  {option.highlight && (
                    <span className="absolute right-4 top-4 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {option.highlight}
                    </span>
                  )}
                  <div
                    className={cn(
                      "inline-flex h-10 w-10 items-center justify-center rounded-xl border text-primary",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-foreground">
                    {option.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 px-6 pb-6 pt-4">
          {!isMarkdown ? (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">ตั้งชื่อกราฟ</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                ตั้งชื่อให้สื่อความหมายชัดเจน เช่น &quot;ยอดขายรวมรายวัน - Top
                5&quot;
              </p>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="กรอกชื่อกราฟ"
                className="mt-4"
              />
            </div>
          ) : (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Text className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">เนื้อหา Markdown</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                ใช้ Markdown เพื่อสรุปข้อมูลหรือระบุ action item สำหรับทีม
              </p>
              <textarea
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="กรอกเนื้อหา Markdown..."
                className="mt-4 w-full min-h-[260px] rounded-xl border bg-background p-4 font-mono text-sm"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                ตัวอย่าง: <strong># Title</strong>, <strong>**bold**</strong>,{" "}
                <strong>- bullet</strong>, <strong>`code`</strong>,{" "}
                <strong>[link](url)</strong>
              </p>
            </div>
          )}

          {!isMarkdown && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    เชื่อมต่อข้อมูล
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    เลือก Connection, Database และ Table
                    เพื่อดึงข้อมูลสำหรับกราฟนี้
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Connection
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        type="button"
                      >
                        {connectionId
                          ? connections.find((c) => c.id === connectionId)
                              ?.name ?? connectionId
                          : "เลือก Connection"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                    >
                      {connections.map((c) => (
                        <DropdownMenuItem
                          key={c.id}
                          onSelect={() => {
                            setConnectionId(c.id);
                            setDatabase("");
                            setTableName("");
                            setTables([]);
                            setDatabases([]);
                          }}
                        >
                          {c.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Database
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 justify-between"
                      onClick={fetchDatabases}
                      disabled={!connectionId}
                      type="button"
                    >
                      {database || "โหลด/เลือก Database"}
                    </Button>
                  </div>
                  {databases.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {databases.map((db) => (
                        <Button
                          key={db}
                          variant={db === database ? "default" : "secondary"}
                          size="sm"
                          onClick={() => {
                            setDatabase(db);
                            setTableName("");
                            setTables([]);
                          }}
                          type="button"
                        >
                          {db}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Table
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 justify-between"
                    onClick={() => fetchTablesForDb(database)}
                    disabled={!connectionId || !database}
                    type="button"
                  >
                    {tableName || "โหลด/เลือก Table"}
                  </Button>
                </div>
                {tables.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {tables.map((t) => (
                      <Button
                        key={t}
                        variant={t === tableName ? "default" : "secondary"}
                        size="sm"
                        onClick={async () => {
                          setTableName(t);
                          const c = connections.find(
                            (x) => x.id === connectionId,
                          );
                          if (!c) return;
                          const res = await fetch("/api/db/columns", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              type: c.type,
                              host: c.host,
                              port: c.port,
                              user: c.user,
                              password: c.password,
                              database,
                              table: t,
                            }),
                          });
                          const data = await res.json();
                          setTableColumns(
                            (data.columns ?? []).map(
                              (x: { name: string }) => x.name,
                            ),
                          );
                        }}
                        type="button"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="กรอกชื่อตาราง (ถ้าไม่มีรายการ)"
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          )}

          {!isMarkdown && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Columns3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {type === "table"
                    ? "เลือกคอลัมน์ที่แสดง"
                    : "เลือก Metric สำหรับ Matrix"}
                </h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {type === "table"
                  ? "เลือกคอลัมน์ที่จะนำมาแสดง สามารถจัดลำดับด้วยการลาก"
                  : "เลือกตัวเลขสำคัญ (สูงสุด 6 รายการ) เพื่อสร้างการ์ดใน Matrix"}
              </p>

              {availableColumns.length > 0 ? (
                <>
                  <div className="mt-4 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-xl border bg-background/80 p-3 sm:grid-cols-2">
                    {availableColumns.map((field) => {
                      const active = selectedColumns.includes(field);
                      return (
                        <button
                          type="button"
                          key={field}
                          onClick={() => handleToggleColumn(field)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 bg-background hover:border-primary/40",
                          )}
                        >
                          <span className="truncate">{field}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedColumns.length > 0 && (
                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          ลำดับคอลัมน์ ({selectedColumns.length})
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllColumns}
                            disabled={!availableColumns.length}
                          >
                            เลือกทั้งหมด
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectAllColumns}
                          >
                            เคลียร์
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedColumns.map((col, idx) => (
                          <div
                            key={col}
                            className="group flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground shadow-sm"
                            draggable
                            onDragStart={() => setDragIndex(idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragIndex === null || dragIndex === idx)
                                return;
                              const next = [...selectedColumns];
                              const [moved] = next.splice(dragIndex, 1);
                              next.splice(idx, 0, moved);
                              setSelectedColumns(next);
                              setDragIndex(null);
                            }}
                          >
                            <span>{col}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleColumn(col)}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-input text-muted-foreground transition hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                              aria-label={`ลบคอลัมน์ ${col}`}
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {isMatrix && selectedColumns.length >= 6 && (
                        <p className="mt-2 text-xs text-amber-600">
                          Matrix แนะนำไม่เกิน 6 ค่าหลักเพื่อความชัดเจน
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-muted-foreground/30 bg-background/60 p-4 text-sm text-muted-foreground">
                  เลือก Table เพื่อดูคอลัมน์ที่พร้อมใช้งาน
                </div>
              )}
            </div>
          )}

          {!isMarkdown && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">ความสูงของกราฟ (px)</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                ปรับความสูงให้พอดีกับเนื้อหา (ค่าแนะนำ 480 - 520px)
              </p>
              <Input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min={200}
                max={1000}
                className="mt-4 w-40"
              />
            </div>
          )}

          {isAxisChart && (
            <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    ตั้งค่ารายละเอียดกราฟ
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    เลือกแกนและการจัดกลุ่ม เพื่อให้กราฟนำเสนอเรื่องราวได้ครบถ้วน
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    แกน X (ชื่อ/หมวดหมู่)
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        {xAxisKey || "เลือกแกน X"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                    >
                      {availableColumns.map((field) => (
                        <DropdownMenuItem
                          key={field}
                          onClick={() => setXAxisKey(field)}
                        >
                          {field}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    แกน Y (ค่า/ตัวเลข)
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        type="button"
                      >
                        {yAxisKey || "เลือกแกน Y"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                    >
                      {availableColumns
                        .filter((field) => field !== xAxisKey)
                        .map((field) => (
                          <DropdownMenuItem
                            key={field}
                            onClick={() => setYAxisKey(field)}
                          >
                            {field}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Group By
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        {groupByKey || xAxisKey || "เลือกฟิลด์"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                    >
                      {availableColumns.map((field) => (
                        <DropdownMenuItem
                          key={field}
                          onClick={() => setGroupByKey(field)}
                        >
                          {field}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Series By (Optional)
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        {seriesKey || "(ไม่แยก)"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                    >
                      <DropdownMenuItem onClick={() => setSeriesKey("")}>
                        ไม่แยก
                      </DropdownMenuItem>
                      {availableColumns.map((field) => (
                        <DropdownMenuItem
                          key={field}
                          onClick={() => setSeriesKey(field)}
                        >
                          {field}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Aggregate
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        {aggregate === "sum"
                          ? "Sum (รวม)"
                          : aggregate === "avg"
                          ? "Average (เฉลี่ย)"
                          : "Count (นับ)"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={cn("w-[200px]", DROPDOWN_MENU_Z)}
                    >
                      <DropdownMenuItem onClick={() => setAggregate("sum")}>
                        Sum (รวม)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAggregate("avg")}>
                        Average (เฉลี่ย)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAggregate("count")}>
                        Count (นับ)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      ชื่อแกน X
                    </label>
                    <Input
                      value={xAxisTitle}
                      onChange={(e) => setXAxisTitle(e.target.value)}
                      placeholder="เช่น เดือน"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      ชื่อแกน Y
                    </label>
                    <Input
                      value={yAxisTitle}
                      onChange={(e) => setYAxisTitle(e.target.value)}
                      placeholder="เช่น ยอดขาย"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    สีของกราฟ
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={seriesColor}
                      onChange={(e) => setSeriesColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded-md border bg-background"
                      aria-label="เลือกสีกราฟ"
                    />
                    <div className="flex gap-2">
                      {[
                        "#f97316",
                        "#0ea5e9",
                        "#22c55e",
                        "#a855f7",
                        "#ef4444",
                      ].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSeriesColor(c)}
                          className="h-7 w-7 rounded-full border border-border transition hover:scale-105"
                          style={{ backgroundColor: c }}
                          aria-label={`preset ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  การเรียงลำดับ (Sort)
                </label>
                <div className="flex flex-wrap gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between md:w-auto"
                      >
                        {sortBy || "เลือก field ที่จะ sort"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className={cn("w-[240px]", DROPDOWN_MENU_Z)}
                    >
                      <DropdownMenuItem onClick={() => setSortBy("")}>
                        ไม่ sort
                      </DropdownMenuItem>
                      {sortCandidates.map((field) => (
                        <DropdownMenuItem
                          key={field}
                          onClick={() => setSortBy(field)}
                        >
                          {field}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {sortBy && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between md:w-auto"
                        >
                          {sortOrder === "asc"
                            ? "↑ น้อย → มาก"
                            : "↓ มาก → น้อย"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={cn("w-[200px]", DROPDOWN_MENU_Z)}
                      >
                        <DropdownMenuItem onClick={() => setSortOrder("asc")}>
                          ↑ น้อย → มาก (Ascending)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortOrder("desc")}>
                          ↓ มาก → น้อย (Descending)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-10 flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                (!isMarkdown && !title.trim()) ||
                (type === "table" && selectedColumns.length === 0) ||
                (isMatrix && selectedColumns.length === 0) ||
                (isMarkdown && !markdownContent.trim()) ||
                (isAxisChart && (!xAxisKey || !yAxisKey))
              }
            >
              บันทึก
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
