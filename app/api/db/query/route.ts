import { NextRequest } from "next/server";
import mysql from "mysql2/promise";
import { Client } from "pg";
import { FilterRule } from "@/types/chart";

type QueryBody = {
  type?: "mysql" | "postgresql";
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  table: string;
  columns?: string[];
  limit?: number;
  filters?: FilterRule[];
};

const buildWhereClause = (
  filters: FilterRule[],
  type: "mysql" | "postgresql",
): { where: string; params: unknown[] } => {
  if (!filters || filters.length === 0) {
    return { where: "", params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  const safeIdent = (name: string) =>
    type === "postgresql"
      ? `"${String(name).replace(/"/g, '""')}"`
      : `\`${String(name).replace(/`/g, "``")}\``;

  for (const filter of filters) {
    if (!filter.field || !filter.op) continue;

    const field = safeIdent(filter.field);
    const op = filter.op;
    const value = filter.value;

    // PostgreSQL uses $1, $2, ... while MySQL uses ?, ?, ...
    const paramPlaceholder = type === "postgresql"
      ? `$${params.length + 1}`
      : "?";

    switch (op) {
      case "equals":
        if (value !== undefined && value !== "") {
          // For date fields, we need to check if this is a date comparison
          // Check if value looks like a date (YYYY-MM-DD format from date input)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (dateRegex.test(String(value))) {
            // Treat as date range: start of day to end of day
            const startDate = new Date(String(value));
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(String(value));
            endDate.setHours(23, 59, 59, 999);
            if (type === "postgresql") {
              conditions.push(
                `${field} >= $${params.length + 1} AND ${field} <= $${params.length + 2}`,
              );
            } else {
              conditions.push(`${field} >= ? AND ${field} <= ?`);
            }
            params.push(startDate.toISOString(), endDate.toISOString());
          } else {
            // Regular equals for non-date values
          conditions.push(`${field} = ${paramPlaceholder}`);
          params.push(value);
          }
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
          params.push(Number(value));
        }
        break;
      case "lt":
        if (value !== undefined && value !== "") {
          conditions.push(`${field} < ${paramPlaceholder}`);
          params.push(Number(value));
        }
        break;
      case "blank":
        conditions.push(`(${field} IS NULL OR ${field} = '' OR ${field} = '')`);
        break;
      case "not_blank":
        conditions.push(
          `(${field} IS NOT NULL AND ${field} != '' AND ${field} != '')`,
        );
        break;
      case "today": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (type === "postgresql") {
          conditions.push(`${field} >= $${params.length + 1} AND ${field} < $${params.length + 2}`);
          params.push(today.toISOString(), tomorrow.toISOString());
        } else {
          conditions.push(`${field} >= ? AND ${field} < ?`);
          params.push(today.toISOString(), tomorrow.toISOString());
        }
        break;
      }
      case "before":
        if (value !== undefined && value !== "") {
          const targetDate =
            String(value).toLowerCase() === "today"
              ? new Date()
              : new Date(String(value));
          if (type === "postgresql") {
            conditions.push(`${field} < $${params.length + 1}`);
          } else {
            conditions.push(`${field} < ?`);
          }
          params.push(targetDate.toISOString());
        }
        break;
      case "after":
        if (value !== undefined && value !== "") {
          const targetDate =
            String(value).toLowerCase() === "today"
              ? new Date()
              : new Date(String(value));
          if (type === "postgresql") {
            conditions.push(`${field} > $${params.length + 1}`);
          } else {
            conditions.push(`${field} > ?`);
          }
          params.push(targetDate.toISOString());
        }
        break;
      case "between":
        if (
          filter.value !== undefined &&
          filter.value !== "" &&
          filter.value2 !== undefined &&
          filter.value2 !== ""
        ) {
          const startDate = new Date(String(filter.value));
          const endDate = new Date(String(filter.value2));
          // Set end date to end of day
          endDate.setHours(23, 59, 59, 999);
          if (type === "postgresql") {
            conditions.push(
              `${field} >= $${params.length + 1} AND ${field} <= $${params.length + 2}`,
            );
          } else {
            conditions.push(`${field} >= ? AND ${field} <= ?`);
          }
          params.push(startDate.toISOString(), endDate.toISOString());
        }
        break;
      case "last_days":
        if (value !== undefined && value !== "") {
          const days = Number(value);
          if (!Number.isNaN(days) && days > 0) {
            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
            if (type === "postgresql") {
              conditions.push(
                `${field} >= $${params.length + 1} AND ${field} <= $${params.length + 2}`,
              );
            } else {
              conditions.push(`${field} >= ? AND ${field} <= ?`);
            }
            params.push(startDate.toISOString(), endDate.toISOString());
          }
        }
        break;
      case "last_months":
        if (value !== undefined && value !== "") {
          const months = Number(value);
          if (!Number.isNaN(months) && months > 0) {
            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            const startDate = new Date(endDate);
            startDate.setMonth(startDate.getMonth() - months);
            startDate.setHours(0, 0, 0, 0);
            if (type === "postgresql") {
              conditions.push(
                `${field} >= $${params.length + 1} AND ${field} <= $${params.length + 2}`,
              );
            } else {
              conditions.push(`${field} >= ? AND ${field} <= ?`);
            }
            params.push(startDate.toISOString(), endDate.toISOString());
          }
        }
        break;
      case "last_week": {
        // Last week: Monday of last week to Sunday of last week
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        // Calculate Monday of last week
        const mondayLastWeek = new Date(today);
        // Go back to last Monday
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days from Monday (if Sunday, go back 6 days)
        mondayLastWeek.setDate(today.getDate() - daysFromMonday - 7); // Go back 7 days to get last week's Monday
        mondayLastWeek.setHours(0, 0, 0, 0);
        // Calculate Sunday of last week
        const sundayLastWeek = new Date(mondayLastWeek);
        sundayLastWeek.setDate(mondayLastWeek.getDate() + 6); // Sunday is 6 days after Monday
        sundayLastWeek.setHours(23, 59, 59, 999);
        if (type === "postgresql") {
          conditions.push(
            `${field} >= $${params.length + 1} AND ${field} <= $${params.length + 2}`,
          );
        } else {
          conditions.push(`${field} >= ? AND ${field} <= ?`);
        }
        params.push(mondayLastWeek.toISOString(), sundayLastWeek.toISOString());
        break;
      }
      case "this_week": {
        // This week: Monday of this week to Sunday of this week
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        // Calculate Monday of this week
        const mondayThisWeek = new Date(today);
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days from Monday (if Sunday, go back 6 days)
        mondayThisWeek.setDate(today.getDate() - daysFromMonday);
        mondayThisWeek.setHours(0, 0, 0, 0);
        // Calculate Sunday of this week
        const sundayThisWeek = new Date(mondayThisWeek);
        sundayThisWeek.setDate(mondayThisWeek.getDate() + 6); // Sunday is 6 days after Monday
        sundayThisWeek.setHours(23, 59, 59, 999);
        if (type === "postgresql") {
          conditions.push(
            `${field} >= $${params.length + 1} AND ${field} <= $${params.length + 2}`,
          );
        } else {
          conditions.push(`${field} >= ? AND ${field} <= ?`);
        }
        params.push(mondayThisWeek.toISOString(), sundayThisWeek.toISOString());
        break;
      }
    }
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QueryBody;
    const {
      type = "mysql",
      host,
      port,
      user,
      password,
      database,
      table,
      columns,
      limit = 500000,
      filters,
    } = body;
    if (!host || !user || !database || !table) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
      });
    }

    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(1000000, Math.trunc(limit))) // Increase max limit to 100,000
      : 50000; // Increase default limit to 50,000

    const { where, params } = buildWhereClause(filters || [], type);

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
        const safeIdent = (name: string) =>
          `"${String(name).replace(/"/g, '""')}"`;
        const cols =
          Array.isArray(columns) && columns.length > 0
            ? columns.map((c) => safeIdent(c)).join(", ")
            : "*";
        const safeTable = safeIdent(table);
        const sql = `SELECT ${cols} FROM ${safeTable} ${where} LIMIT $${params.length + 1}`;
        const result = await client.query(sql, [...params, safeLimit]);
        await client.end();
        return new Response(JSON.stringify({ rows: result.rows }), {
          status: 200,
        });
      } catch (e: unknown) {
        await client.end().catch(() => { });
        throw e;
      }
    } else {
      const connection = await mysql.createConnection({
        host,
        port: port || 3306,
        user,
        password,
        database,
      });

      const safeIdent = (name: string) =>
        `\`${String(name).replace(/`/g, "``")}\``;
      const cols =
        Array.isArray(columns) && columns.length > 0
          ? columns.map((c) => safeIdent(c)).join(", ")
          : "*";
      const safeTable = safeIdent(table);
      const sql = `SELECT ${cols} FROM ${safeTable} ${where} LIMIT ?`;
      const [rows] = await connection.query(sql, [...params, safeLimit]);
      await connection.end();

      return new Response(JSON.stringify({ rows }), { status: 200 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
