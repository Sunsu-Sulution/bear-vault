import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ChartConfig } from "@/types/chart";
import mysql from "mysql2/promise";
import { Client } from "pg";

const COLLECTION_NAME = "chart_configs";
const CONNECTIONS_COLLECTION = "db_connections";

// GET /api/public/tab/[tabId]
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tabId: string }> | { tabId: string } }
) {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const tabId = params.tabId;

    console.log("Fetching tab with ID:", tabId);

    if (!tabId) {
      return NextResponse.json(
        { error: "tabId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const chartCollection = db.collection(COLLECTION_NAME);
    const connectionsCollection = db.collection(CONNECTIONS_COLLECTION);
    const tabsCollection = db.collection("dashboard_tabs");

    // Check if tab is public
    const tabsDoc = await tabsCollection.findOne({ id: "default" });
    if (tabsDoc && tabsDoc.tabs && Array.isArray(tabsDoc.tabs)) {
      const tab = tabsDoc.tabs.find((t: { id: string; isPublic?: boolean }) => t.id === tabId);
      if (!tab || !tab.isPublic) {
        console.error("Tab is not public or not found:", tabId);
        return NextResponse.json(
          { error: "Tab is not public" },
          { status: 403 }
        );
      }
    } else {
      console.error("Tabs document not found");
      return NextResponse.json(
        { error: "Tab not found" },
        { status: 404 }
      );
    }

    const pagePath = `/dashboard/${tabId}`;
    const doc = await chartCollection.findOne({ pagePath });

    if (!doc || !doc.charts || !Array.isArray(doc.charts)) {
      console.error("Tab not found for ID:", tabId);
      return NextResponse.json(
        { error: "Tab not found" },
        { status: 404 }
      );
    }

    const charts: ChartConfig[] = doc.charts;

    // Get connections for fetching data
    const connectionsDoc = await connectionsCollection.findOne({
      id: "default",
    });

    if (!connectionsDoc || !connectionsDoc.connections) {
      return NextResponse.json({
        charts,
        pagePath,
        chartsData: {},
        chartsColumns: {},
      });
    }

    const connections = connectionsDoc.connections;

    // Fetch data for each chart
    const chartsData: Record<string, Record<string, unknown>[]> = {};
    const chartsColumns: Record<string, string[]> = {};

    for (const chart of charts) {
      if (chart.connectionId && chart.database) {
        const connection = connections.find(
          (c: { id: string }) => c.id === chart.connectionId
        );

        if (connection) {
          try {
            if (chart.sqlQuery) {
              const sqlData = await fetchSQLData(
                connection.type || "mysql",
                connection.host,
                connection.port,
                connection.user,
                connection.password,
                chart.database,
                chart.sqlQuery
              );
              chartsData[chart.id] = sqlData.rows || [];
              chartsColumns[chart.id] = sqlData.columns || [];
            } else if (chart.tableName) {
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
              chartsData[chart.id] = tableData.rows || [];
              chartsColumns[chart.id] = tableData.columns || [];
            }
          } catch (error) {
            console.error(`Error fetching data for chart ${chart.id}:`, error);
            chartsData[chart.id] = [];
            chartsColumns[chart.id] = [];
          }
        }
      }
    }

    return NextResponse.json({
      charts,
      pagePath,
      chartsData,
      chartsColumns,
    });
  } catch (error) {
    console.error("Error fetching public tab:", error);
    return NextResponse.json(
      { error: "Failed to fetch tab", details: error instanceof Error ? error.message : String(error) },
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
      await client.end().catch(() => { });
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
      await conn.end().catch(() => { });
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
      await client.end().catch(() => { });
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
      await conn.end().catch(() => { });
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

  let paramIndex = 0;
  const paramPlaceholder = (type === "postgresql")
    ? () => `$${++paramIndex}`
    : () => "?";

  for (const filter of filters) {
    if (!filter.field || !filter.op) continue;

    const field = safeIdent(filter.field);
    const op = filter.op;
    const value = filter.value;

    switch (op) {
      case "equals":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} = ${paramPlaceholder()}`);
          params.push(value);
        }
        break;
      case "not_equals":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} != ${paramPlaceholder()}`);
          params.push(value);
        }
        break;
      case "contains":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} LIKE ${paramPlaceholder()}`);
          params.push(`%${value}%`);
        }
        break;
      case "not_contains":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} NOT LIKE ${paramPlaceholder()}`);
          params.push(`%${value}%`);
        }
        break;
      case "begins_with":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} LIKE ${paramPlaceholder()}`);
          params.push(`${value}%`);
        }
        break;
      case "ends_with":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} LIKE ${paramPlaceholder()}`);
          params.push(`%${value}`);
        }
        break;
      case "gt":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} > ${paramPlaceholder()}`);
          params.push(value);
        }
        break;
      case "lt":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} < ${paramPlaceholder()}`);
          params.push(value);
        }
        break;
      case "blank":
        conditions.push(`${field} IS NULL`);
        break;
      case "not_blank":
        conditions.push(`${field} IS NOT NULL`);
        break;
    }
  }

  return {
    where: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

