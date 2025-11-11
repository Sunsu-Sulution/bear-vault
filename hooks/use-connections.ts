"use client";

import { useMemo, useState, useEffect } from "react";

export type DbType = "mysql" | "postgresql";

export type DbConnection = {
  id: string;
  name: string;
  type: DbType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  schema?: string;
  aiReadable?: boolean;
};

type State = {
  connections: DbConnection[];
  activeId?: string;
};

export function useConnections() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const response = await fetch("/api/user-configs/connections");
        if (response.ok) {
          const data = (await response.json()) as State;
          const normalized = (data.connections ?? []).map((conn) => ({
            aiReadable: conn.aiReadable ?? true,
            ...conn,
          }));
          setConnections(normalized);
          setActiveId(data.activeId);
      }
      } catch (error) {
        console.error("Error loading connections:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadConnections();
  }, []);

  const persist = async (next: Partial<State>) => {
    const state: State = {
      connections,
      activeId,
      ...next,
    };
    try {
      const response = await fetch("/api/user-configs/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(state),
      });
      if (!response.ok) {
        throw new Error("Failed to save connections");
      }
    } catch (error) {
      console.error("Error saving connections:", error);
    }
  };

  const addConnection = (conn: Omit<DbConnection, "id">) => {
    const id = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const full: DbConnection = {
      id,
      aiReadable: true,
      ...conn,
    };
    const next = [...connections, full];
    setConnections(next);
    if (!activeId) setActiveId(id);
    persist({ connections: next, activeId: activeId ?? id });
    return id;
  };

  const updateConnection = (id: string, patch: Partial<DbConnection>) => {
    const next = connections.map((c) => (c.id === id ? { ...c, ...patch } : c));
    setConnections(next);
    persist({ connections: next });
  };

  const removeConnection = (id: string) => {
    const next = connections.filter((c) => c.id !== id);
    const nextActive = activeId === id ? next[0]?.id : activeId;
    setConnections(next);
    setActiveId(nextActive);
    persist({ connections: next, activeId: nextActive });
  };

  const setActive = (id: string) => {
    setActiveId(id);
    persist({ activeId: id });
  };

  const active = useMemo(() => connections.find((c) => c.id === activeId), [connections, activeId]);

  return {
    isLoaded,
    connections,
    activeId,
    active,
    addConnection,
    updateConnection,
    removeConnection,
    setActive,
  };
}
