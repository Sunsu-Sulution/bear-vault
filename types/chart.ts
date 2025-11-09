import { ColDef } from "ag-grid-community";

export type ChartType = "table" | "bar" | "line" | "pie" | "matrix" | "markdown";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "begins_with"
  | "ends_with"
  | "gt"
  | "lt"
  | "before"
  | "after"
  | "today"
  | "between"
  | "last_days"
  | "last_months"
  | "last_week"
  | "this_week"
  | "blank"
  | "not_blank";

export interface FilterRule {
  field: string;
  op: FilterOperator;
  value?: string; // ISO date or string/number depending on op
  value2?: string; // For "between" operator - end date
}

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  height: number;
  width?: number; // width in percentage (optional, defaults to full width)
  connectionId?: string;
  database?: string;
  tableName?: string;
  sqlQuery?: string; // SQL query for dynamic charts
  columns: string[];
  // สำหรับ table
  columnDefs?: ColDef[];
  // สำหรับกราฟอื่นๆ (อนาคต)
  dataKey?: string;
  xAxisKey?: string;
  yAxisKey?: string;
  // grouping & series
  groupByKey?: string; // field to group X by (defaults to xAxisKey)
  seriesKey?: string; // field to split into multiple series
  aggregate?: "sum" | "count" | "avg"; // aggregate yAxisKey over group
  filters?: FilterRule[];
  sortBy?: string; // field to sort by
  sortOrder?: "asc" | "desc"; // sort order
  color?: string; // hex or CSS var used for chart series
  // axis titles
  xAxisTitle?: string;
  yAxisTitle?: string;
  // markdown content
  markdownContent?: string;
  aiGenerated?: boolean;
}

export interface ChartConfigsState {
  charts: ChartConfig[];
}

