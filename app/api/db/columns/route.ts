import { NextRequest } from "next/server";
import mysql from "mysql2/promise";
import { Client } from "pg";

type Conn = {
  type?: "mysql" | "postgresql";
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  table: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Conn;
    const { type = "mysql", host, port, user, password, database, table } = body;
    if (!host || !user || !database || !table) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
      });
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
        const result = await client.query(
          `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position;`,
          [table]
        );
        await client.end();

        const columns = result.rows.map((r) => ({
          name: r.column_name as string,
          type: r.data_type as string,
          nullable: r.is_nullable === "YES",
        }));

        return new Response(JSON.stringify({ columns }), { status: 200 });
      } catch (e: unknown) {
        await client.end().catch(() => {});
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

      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${table}\``
      );
      await connection.end();

      const columns = rows.map((r) => ({
        name: r.Field as string,
        type: r.Type as string,
        nullable: (r.Null as string) === "YES",
      }));

      return new Response(JSON.stringify({ columns }), { status: 200 });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500 }
    );
  }
}
