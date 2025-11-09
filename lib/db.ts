import mysql, { Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST || "localhost";
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "";
  const port = Number(process.env.MYSQL_PORT || 3306);

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
  });

  return pool;
}

export async function pingDb(): Promise<{ ok: boolean; message: string }>{
  try {
    const p = getDbPool();
    await p.query("SELECT 1 AS ok");
    return { ok: true, message: "MySQL connected" };
  } catch (e: any) {
    return { ok: false, message: e?.message || "MySQL error" };
  }
}
