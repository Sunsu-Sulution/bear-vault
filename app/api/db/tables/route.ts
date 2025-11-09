import { NextRequest } from "next/server";
import mysql from "mysql2/promise";
import { Client } from "pg";

type Conn = {
  type?: "mysql" | "postgresql";
  host: string;
  port?: number;
  user: string;
  password: string;
  database?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Conn;
    const { type = "mysql", host, port, user, password, database } = body;
    if (!host || !user) {
      return new Response(JSON.stringify({ error: "Missing host/user" }), {
        status: 400,
      });
    }

    if (type === "postgresql") {
      const client = new Client({
        host,
        port: port || 5432,
        user,
        password,
        database: database || "postgres",
      });
      await client.connect();

      try {
        if (!database) {
          const result = await client.query(
            "SELECT datname FROM pg_database WHERE datistemplate = false;"
          );
          await client.end();
          return new Response(
            JSON.stringify({
              databases: result.rows.map((r) => r.datname as string),
            }),
            { status: 200 }
          );
        }

        const result = await client.query(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
        );
        await client.end();
        return new Response(
          JSON.stringify({
            tables: result.rows.map((r) => r.tablename as string),
          }),
          { status: 200 }
        );
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
        database: database || undefined,
      });

      if (!database) {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
          "SHOW DATABASES;"
        );
        await connection.end();
        return new Response(
          JSON.stringify({
            databases: rows.map((r) => r["Database"] as string),
          }),
          { status: 200 }
        );
      }

      const [tables] = await connection.query<mysql.RowDataPacket[]>(
        "SHOW TABLES;"
      );
      await connection.end();

      const key = `Tables_in_${database}`;
      const list = tables.map((t) => (t as Record<string, unknown>)[key] as string);

      return new Response(JSON.stringify({ tables: list }), { status: 200 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500 }
    );
  }
}
