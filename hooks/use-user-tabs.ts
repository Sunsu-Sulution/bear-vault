"use client";

import { useEffect, useMemo, useState } from "react";

export type UserTab = {
  id: string;
  name: string;
  url: string;
  icon?: string; // optional: icon name (future)
};

const STORAGE_KEY_PREFIX = "user_tabs:";

export function useUserTabs(userEmail: string | undefined | null) {
  const storageKey = useMemo(
    () => `${STORAGE_KEY_PREFIX}${userEmail || "guest"}`,
    [userEmail]
  );

  const [tabs, setTabs] = useState<UserTab[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoaded(true);
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as UserTab[];
        if (Array.isArray(parsed)) setTabs(parsed);
      }
    } catch (e) {
      console.error("Failed to load user tabs", e);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  const save = (next: UserTab[]) => {
    setTabs(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  };

  const addTab = (name: string, url: string) => {
    const id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next = [...tabs, { id, name, url }];
    save(next);
    return id;
  };

  const removeTab = (id: string) => {
    save(tabs.filter((t) => t.id !== id));
  };

  const updateTab = (id: string, updates: Partial<Pick<UserTab, "name" | "url">>) => {
    save(tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const exportTabs = (): string => {
    return JSON.stringify(tabs, null, 2);
  };

  const importTabs = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        // basic shape validation
        const cleaned: UserTab[] = parsed
          .filter((t) => t && typeof t.name === "string" && typeof t.url === "string")
          .map((t) => ({ id: t.id || `tab_${Math.random().toString(36).slice(2)}`, name: t.name, url: t.url }));
        save(cleaned);
      }
    } catch (e) {
      console.error("Invalid tabs JSON", e);
    }
  };

  return { tabs, isLoaded, addTab, removeTab, updateTab, exportTabs, importTabs };
}
