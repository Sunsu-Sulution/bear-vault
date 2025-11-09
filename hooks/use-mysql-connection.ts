"use client";

import { useEffect, useState } from "react";

export type MysqlConn = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

const STORAGE_KEY = "mysql_conn_global";

export function useMysqlConnection() {
  const [conn, setConn] = useState<MysqlConn>({
    host: "",
    port: 3306,
    user: "",
    password: "",
    database: "",
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw) as Partial<MysqlConn>;
        setConn({
          host: v.host ?? "",
          port: v.port ?? 3306,
          user: v.user ?? "",
          password: v.password ?? "",
          database: v.database ?? "",
        });
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  const save = (next: Partial<MysqlConn>) => {
    setConn((prev) => {
      const merged = { ...prev, ...next } as MysqlConn;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  return { conn, isLoaded, save };
}


