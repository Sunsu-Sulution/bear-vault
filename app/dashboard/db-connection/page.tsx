"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnections, type DbType } from "@/hooks/use-connections";
import { Database, RefreshCw, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useHelperContext } from "@/components/providers/helper-provider";
import { useRouter } from "next/navigation";

type TablesResponse = {
  databases?: string[];
  tables?: string[];
  error?: string;
};

export default function Page() {
  const {
    connections,
    addConnection,
    updateConnection,
    removeConnection,
  } = useConnections();
  const { permissions, router } = useHelperContext()();
  const [isFetching, setIsFetching] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    Record<string, { success: boolean; message?: string }>
  >({});

  // Check permissions and redirect if no access
  useEffect(() => {
    if (permissions !== null && !permissions.canView) {
      router.push("/dashboard/no-permission");
    }
  }, [permissions, router]);

  // Don't render if no permission
  if (permissions !== null && !permissions.canView) {
    return null;
  }

  const testConnection = async (
    conn: ReturnType<typeof useConnections>["connections"][0],
  ) => {
    if (!conn.host || !conn.user) {
      return { success: false, message: "กรุณากรอก host และ user" };
    }

    try {
      const res = await fetch("/api/db/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: conn.type,
          host: conn.host,
          port: conn.port,
          user: conn.user,
          password: conn.password,
          database: conn.database,
        }),
      });
      const data: TablesResponse = await res.json();

      if (data.error) {
        return { success: false, message: data.error };
      }

      return { success: true, message: "เชื่อมต่อสำเร็จ" };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ";
      return { success: false, message };
    }
  };

  const testAllConnections = async () => {
    setIsFetching(true);
    const statuses: Record<string, { success: boolean; message?: string }> = {};

    for (const conn of connections) {
      const result = await testConnection(conn);
      statuses[conn.id] = result;
    }

    setConnectionStatus(statuses);
    setIsFetching(false);
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold">Database Connections</div>
        <Button
          variant="outline"
          onClick={testAllConnections}
          disabled={connections.length === 0 || isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />{" "}
          Test Connection
        </Button>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 font-medium">
          <Database className="h-4 w-4" /> Manage Connections
        </div>
        <div className="space-y-2">
          {connections.map((c) => {
            const status = connectionStatus[c.id];
            return (
              <div key={c.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Connection name"
                    value={c.name}
                    onChange={(e) =>
                      updateConnection(c.id, { name: e.target.value })
                    }
                  />
                  <select
                    className="flex h-10 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={c.type}
                    onChange={(e) =>
                      updateConnection(c.id, {
                        type: e.target.value as DbType,
                        port: e.target.value === "postgresql" ? 5432 : 3306,
                      })
                    }
                  >
                    <option value="mysql">MySQL</option>
                    <option value="postgresql">PostgreSQL</option>
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => removeConnection(c.id)}
                  >
                    ลบ
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <label className="inline-flex items-center gap-2 font-medium text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-input text-primary focus:ring-2 focus:ring-primary/50"
                      checked={c.aiReadable !== false}
                      onChange={(event) =>
                        updateConnection(c.id, { aiReadable: event.target.checked })
                      }
                    />
                    อนุญาตให้ AI ใช้งาน
                  </label>
                  <span>
                    {c.aiReadable === false
                      ? "AI จะไม่ใช้ connection นี้"
                      : "AI สามารถอ่านข้อมูลจาก connection นี้"}
                  </span>
                </div>
                {status && (
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      status.success ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {status.success && (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{status.message}</span>
                      </>
                    )}
                    {!status.success && <span>{status.message}</span>}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Input
                    placeholder="host"
                    value={c.host}
                    onChange={(e) =>
                      updateConnection(c.id, { host: e.target.value })
                    }
                  />
                  <Input
                    placeholder="port"
                    type="number"
                    value={c.port}
                    onChange={(e) =>
                      updateConnection(c.id, { port: Number(e.target.value) })
                    }
                  />
                  <Input
                    placeholder="user"
                    value={c.user}
                    onChange={(e) =>
                      updateConnection(c.id, { user: e.target.value })
                    }
                  />
                  <Input
                    placeholder="password"
                    type="password"
                    value={c.password}
                    onChange={(e) =>
                      updateConnection(c.id, { password: e.target.value })
                    }
                  />
                  <Input
                    placeholder="database (optional)"
                    value={c.database}
                    onChange={(e) =>
                      updateConnection(c.id, { database: e.target.value })
                    }
                  />
                </div>
              </div>
            );
          })}
          <Button
            variant="outline"
            onClick={() =>
              addConnection({
                name: "New Connection",
                type: "mysql",
                host: "",
                port: 3306,
                user: "",
                password: "",
                database: "",
              })
            }
          >
            เพิ่ม Connection
          </Button>
        </div>
      </div>
    </div>
  );
}
