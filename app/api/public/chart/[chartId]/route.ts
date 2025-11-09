import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ChartConfig } from "@/types/chart";
import mysql from "mysql2/promise";
import { Client } from "pg";

const COLLECTION_NAME = "chart_configs";
const CONNECTIONS_COLLECTION = "db_connections";

// GET /api/public/chart/[chartId]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chartId: string }> | { chartId: string } }
) {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const chartId = params.chartId;

    console.log("Fetching chart with ID:", chartId);

    if (!chartId) {
      return NextResponse.json(
        { error: "chartId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const chartCollection = db.collection(COLLECTION_NAME);

    // Search through all pagePaths to find the chart
    const docs = await chartCollection.find({}).toArray();
    
    console.log(`Found ${docs.length} pagePath documents`);
    
    let chart: ChartConfig | null = null;
    let pagePath: string | null = null;

    for (const doc of docs) {
      if (doc.charts && Array.isArray(doc.charts)) {
        console.log(`Checking pagePath ${doc.pagePath}, found ${doc.charts.length} charts`);
        const foundChart = doc.charts.find((c: ChartConfig) => c.id === chartId);
        if (foundChart) {
          chart = foundChart;
          pagePath = doc.pagePath;
          break;
        }
      }
    }

    if (!chart) {
      console.error("Chart not found for ID:", chartId);
      // Log all chart IDs for debugging
      const allChartIds: string[] = [];
      docs.forEach((doc) => {
        if (doc.charts && Array.isArray(doc.charts)) {
          doc.charts.forEach((c: ChartConfig) => {
            allChartIds.push(c.id);
          });
        }
      });
      console.error("Available chart IDs:", allChartIds);
      return NextResponse.json(
        { error: "Chart not found", chartId, totalDocs: docs.length, availableIds: allChartIds },
        { status: 404 }
      );
    }

    // If chart needs data, fetch it server-side
    if (chart.connectionId && chart.database) {
      // Get connection info
      const connectionsCollection = db.collection(CONNECTIONS_COLLECTION);
      const connectionsDoc = await connectionsCollection.findOne({
        id: "default",
      });
      
      if (connectionsDoc && connectionsDoc.connections) {
        const connection = connectionsDoc.connections.find(
          (c: { id: string }) => c.id === chart.connectionId
        );

        if (connection) {
          let data: Record<string, unknown>[] = [];
          let columns: string[] = [];

          if (chart.sqlQuery) {
            // Fetch SQL query data
            const sqlData = await fetchSQLData(
              connection.type || "mysql",
              connection.host,
              connection.port,
              connection.user,
              connection.password,
              chart.database,
              chart.sqlQuery
            );
            data = sqlData.rows || [];
            columns = sqlData.columns || [];
          } else if (chart.tableName) {
            // Fetch table data
            const tableData = await fetchTableData(
              connection.type || "mysql",
              connection.host,
              connection.port,
              connection.user,
              connection.password,
              chart.database,
              chart.tableName,
              chart.columns,
              chart.filters || []
            );
            data = tableData.rows || [];
            columns = tableData.columns || [];
          }

          return NextResponse.json({
            chart,
            pagePath,
            data,
            columns,
          });
        } else {
          console.error("Connection not found:", chart.connectionId);
        }
      } else {
        console.error("Connections doc not found or empty");
      }
    }

    return NextResponse.json({
      chart,
      pagePath,
      data: [],
      columns: [],
    });
  } catch (error) {
    console.error("Error fetching public chart:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function fetchSQLData(
  type: "mysql" | "postgresql",
  host: string,
  port: number | undefined,
  user: string,
  password: string,
  database: string,
  sqlQuery: string
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  if (type === "postgresql") {
    const client = new Client({
      host,
      port: port || 5432,
      user,
      password,
      database,
    });
    await client.connect();
    try {
      const result = await client.query(sqlQuery);
      const columns = result.fields?.map((field) => field.name) || [];
      await client.end();
      return {
        rows: result.rows as Record<string, unknown>[],
        columns,
      };
    } catch (error) {
      await client.end().catch(() => {});
      throw error;
    }
  } else {
    const conn = await mysql.createConnection({
      host,
      port: port || 3306,
      user,
      password,
      database,
    });
    try {
      const [rows, fields] = await conn.execute(sqlQuery);
      const columns =
        Array.isArray(fields) && fields.length > 0
          ? fields.map((field: mysql.FieldPacket) => field.name)
          : [];
      await conn.end();
      return {
        rows: rows as Record<string, unknown>[],
        columns,
      };
    } catch (error) {
      await conn.end().catch(() => {});
      throw error;
    }
  }
}

async function fetchTableData(
  type: "mysql" | "postgresql",
  host: string,
  port: number | undefined,
  user: string,
  password: string,
  database: string,
  table: string,
  columns?: string[],
  filters?: Array<{ field?: string; op?: string; value?: unknown }>
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  // Build WHERE clause
  const whereClause = buildWhereClause(filters || [], type);
  const safeIdent = (name: string) =>
    type === "postgresql"
      ? `"${String(name).replace(/"/g, '""')}"`
      : `\`${String(name).replace(/`/g, "``")}\``;

  const selectCols =
    columns && columns.length > 0
      ? columns.map((c) => safeIdent(c)).join(", ")
      : "*";

  const sql = `SELECT ${selectCols} FROM ${safeIdent(table)}${whereClause.where} LIMIT 50000`;

  if (type === "postgresql") {
    const client = new Client({
      host,
      port: port || 5432,
      user,
      password,
      database,
    });
    await client.connect();
    try {
      const result = await client.query(sql, whereClause.params);
      const columns = result.fields?.map((field) => field.name) || [];
      await client.end();
      return {
        rows: result.rows as Record<string, unknown>[],
        columns,
      };
    } catch (error) {
      await client.end().catch(() => {});
      throw error;
    }
  } else {
    const conn = await mysql.createConnection({
      host,
      port: port || 3306,
      user,
      password,
      database,
    });
    try {
      const [rows, fields] = await conn.execute(sql, whereClause.params);
      const columnNames =
        Array.isArray(fields) && fields.length > 0
          ? fields.map((field: mysql.FieldPacket) => field.name)
          : [];
      await conn.end();
      return {
        rows: rows as Record<string, unknown>[],
        columns: columnNames,
      };
    } catch (error) {
      await conn.end().catch(() => {});
      throw error;
    }
  }
}

function buildWhereClause(
  filters: Array<{ field?: string; op?: string; value?: unknown }>,
  type: "mysql" | "postgresql"
): { where: string; params: unknown[] } {
  if (!filters || filters.length === 0) {
    return { where: "", params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  const safeIdent = (name: string) =>
    type === "postgresql"
      ? `"${String(name).replace(/"/g, '""')}"`
      : `\`${String(name).replace(/`/g, "``")}\``;

  const paramPlaceholder = type === "postgresql"
    ? `$${params.length + 1}`
    : "?";

  for (const filter of filters) {
    if (!filter.field || !filter.op) continue;

    const field = safeIdent(filter.field);
    const op = filter.op;
    const value = filter.value;

    switch (op) {
      case "equals":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} = ${paramPlaceholder}`);
          params.push(value);
        }
        break;
      case "not_equals":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} != ${paramPlaceholder}`);
          params.push(value);
        }
        break;
      case "contains":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} LIKE ${paramPlaceholder}`);
          params.push(`%${value}%`);
        }
        break;
      case "not_contains":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} NOT LIKE ${paramPlaceholder}`);
          params.push(`%${value}%`);
        }
        break;
      case "begins_with":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} LIKE ${paramPlaceholder}`);
          params.push(`${value}%`);
        }
        break;
      case "ends_with":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} LIKE ${paramPlaceholder}`);
          params.push(`%${value}`);
        }
        break;
      case "gt":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} > ${paramPlaceholder}`);
          params.push(value);
        }
        break;
      case "lt":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} < ${paramPlaceholder}`);
          params.push(value);
        }
        break;
      case "blank":
        conditions.push(`${field} IS NULL`);
        break;
      case "not_blank":
        conditions.push(`${field} IS NOT NULL`);
        break;
      // Add more operators as needed
    }
  }

  return {
    where: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}
