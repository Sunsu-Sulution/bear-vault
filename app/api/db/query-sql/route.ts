import { NextRequest } from "next/server";
import mysql from "mysql2/promise";
import { Client } from "pg";

type QuerySqlBody = {
  type?: "mysql" | "postgresql";
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  sql: string;
  limit?: number;
  page?: number;
  pageSize?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QuerySqlBody;
    const {
      type = "mysql",
      host,
      port,
      user,
      password,
      database,
      sql,
      limit = 500000,
    } = body;

    if (!host || !user || !database || !sql) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 },
      );
    }

    // Validate SQL - only allow SELECT statements for security
    const trimmedSql = sql.trim().toUpperCase();
    if (
      !trimmedSql.startsWith("SELECT") &&
      !trimmedSql.startsWith("WITH")
    ) {
      return new Response(
        JSON.stringify({
          error: "Only SELECT and WITH statements are allowed",
        }),
        { status: 400 },
      );
    }

    // Add LIMIT clause only if limit is provided
    let finalSql = sql.trim();
    const sqlUpper = sql.toUpperCase();

    // Check if LIMIT already exists
    if (!sqlUpper.includes("LIMIT")) {
      // Only add LIMIT if limit is provided
      if (limit !== undefined && limit !== null) {
        const safeLimit = Number.isFinite(limit)
          ? Math.max(1, Math.min(1000000, Math.trunc(limit))) // Increase max limit to 100,000
          : 50000; // Increase default limit to 50,000

        // Check if query contains UNION or UNION ALL
        const hasUnion = sqlUpper.includes("UNION");

        if (hasUnion) {
          // For UNION queries, wrap the entire query in a subquery and apply LIMIT
          finalSql = `SELECT * FROM (${sql.trim()}) AS union_result LIMIT ${safeLimit}`;
        } else {
          // For regular queries, just append LIMIT
          finalSql = `${sql.trim()} LIMIT ${safeLimit}`;
        }
      }
      // If limit is not provided, don't add LIMIT clause - fetch all data
    }

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
        const result = await client.query(finalSql);
        await client.end();

        // Extract column names from result metadata (available even with 0 rows)
        const columns = result.fields?.map((field) => field.name) || [];

        return new Response(
          JSON.stringify({
            rows: result.rows,
            columns: columns.length > 0 ? columns : undefined,
          }),
          { status: 200 }
        );
      } catch (e: unknown) {
        await client.end().catch(() => { });
        throw e;
      }
    } else {
      // MySQL
      const connection = await mysql.createConnection({
        host,
        port: port || 3306,
        user,
        password,
        database,
      });

      try {
        const [rows, fields] = await connection.query(finalSql);
        await connection.end();

        // Extract column names from result metadata (available even with 0 rows)
        const columns =
          Array.isArray(fields) && fields.length > 0
            ? fields.map((field: mysql.FieldPacket) => field.name)
            : undefined;

        return new Response(
          JSON.stringify({
            rows,
            columns: columns,
          }),
          { status: 200 }
        );
      } catch (e: unknown) {
        await connection.end().catch(() => { });
        throw e;
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

