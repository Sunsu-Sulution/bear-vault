"use client";

import { useState, useEffect, useCallback } from "react";
import { ChartConfig, ChartConfigsState } from "@/types/chart";
import { recordChange } from "@/lib/record-change";

interface UseChartConfigsOptions {
  tabId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export function useChartConfigs(pagePath: string, options?: UseChartConfigsOptions) {
  const [configs, setConfigs] = useState<ChartConfig[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadConfigs = useCallback(async () => {
    if (typeof window === "undefined") {
      setIsLoaded(true);
      return;
    }

    try {
      const response = await fetch(
        `/api/user-configs/charts?pagePath=${encodeURIComponent(pagePath)}`
      );
      if (response.ok) {
        const data = (await response.json()) as ChartConfigsState;
        if (data && typeof data === "object" && Array.isArray(data.charts)) {
          setConfigs(data.charts);
        }
      }
    } catch (error) {
      console.error("Error loading chart configs:", error);
    } finally {
      setIsLoaded(true);
    }
  }, [pagePath]);

  // โหลด configs เมื่อ component mount หรือ pagePath เปลี่ยน
  useEffect(() => {
    setIsLoaded(false);
    loadConfigs();
  }, [loadConfigs]);

  // ฟัง event ภายนอกเพื่อ refresh charts
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ pagePath?: string }>;
      const targetPath = customEvent.detail?.pagePath;
      if (!targetPath || targetPath === pagePath) {
        setIsLoaded(false);
        loadConfigs();
      }
    };

    window.addEventListener("charts:refresh", handler as EventListener);
    return () => {
      window.removeEventListener("charts:refresh", handler as EventListener);
    };
  }, [loadConfigs, pagePath]);

  // บันทึก configs ไป MongoDB
  const saveConfigs = async (newConfigs: ChartConfig[]) => {
    setConfigs(newConfigs);
    if (typeof window === "undefined") {
      return;
    }
    
    try {
      const response = await fetch("/api/user-configs/charts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pagePath,
          charts: newConfigs,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save chart configs");
      }
    } catch (error) {
      console.error("Error saving chart configs:", error);
    }
  };

  // เพิ่มกราฟใหม่
  const addChart = (config: Omit<ChartConfig, "id">) => {
    const newChart: ChartConfig = {
      ...config,
      id: `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    saveConfigs([...configs, newChart]);
    
    // Record change
    if (options?.tabId && options?.userId) {
      recordChange({
        tabId: options.tabId,
        userId: options.userId,
        userName: options.userName || options.userId,
        userEmail: options.userEmail || "",
        action: "create",
        entityType: "chart",
        entityId: newChart.id,
        entityName: newChart.title,
      });
    }
    
    return newChart.id;
  };

  // เพิ่มกราฟใหม่ที่ index ที่กำหนด
  const insertChart = (config: Omit<ChartConfig, "id">, index: number) => {
    const newChart: ChartConfig = {
      ...config,
      id: `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    const newConfigs = [...configs];
    newConfigs.splice(index, 0, newChart);
    saveConfigs(newConfigs);
    
    // Record change
    if (options?.tabId && options?.userId) {
      recordChange({
        tabId: options.tabId,
        userId: options.userId,
        userName: options.userName || options.userId,
        userEmail: options.userEmail || "",
        action: "create",
        entityType: "chart",
        entityId: newChart.id,
        entityName: newChart.title,
      });
    }
    
    return newChart.id;
  };

  // อัพเดทกราฟ
  const updateChart = (id: string, updates: Partial<ChartConfig>, skipHistory?: boolean) => {
    const oldChart = configs.find((c) => c.id === id);
    const updated = configs.map((chart) =>
      chart.id === id ? { ...chart, ...updates } : chart
    );
    saveConfigs(updated);
    
    // Record change (skip for resize previews)
    if (!skipHistory && options?.tabId && options?.userId && oldChart) {
      // Only record if values actually changed
      const hasChanges = Object.entries(updates).some(([key, newValue]) => {
        if (key === "id") return false;
        const oldValue = oldChart[key as keyof ChartConfig];
        return JSON.stringify(oldValue) !== JSON.stringify(newValue);
      });
      
      if (hasChanges) {
        const changes = Object.entries(updates)
          .filter(([key]) => key !== "id")
          .filter(([key, newValue]) => {
            const oldValue = oldChart[key as keyof ChartConfig];
            return JSON.stringify(oldValue) !== JSON.stringify(newValue);
          })
          .map(([field, newValue]) => ({
            field,
            oldValue: oldChart[field as keyof ChartConfig],
            newValue,
          }));
        
        recordChange({
          tabId: options.tabId,
          userId: options.userId,
          userName: options.userName || options.userId,
          userEmail: options.userEmail || "",
          action: "update",
          entityType: "chart",
          entityId: id,
          entityName: updates.title || oldChart.title,
          changes: changes.length > 0 ? changes : undefined,
        });
      }
    }
  };

  // ลบกราฟ
  const removeChart = (id: string) => {
    const chartToRemove = configs.find((c) => c.id === id);
    saveConfigs(configs.filter((chart) => chart.id !== id));
    
    // Record change
    if (options?.tabId && options?.userId && chartToRemove) {
      recordChange({
        tabId: options.tabId,
        userId: options.userId,
        userName: options.userName || options.userId,
        userEmail: options.userEmail || "",
        action: "delete",
        entityType: "chart",
        entityId: id,
        entityName: chartToRemove.title,
      });
    }
  };

  // ลบทั้งหมด
  const clearAll = () => {
    saveConfigs([]);
  };

  // Reorder กราฟ
  const reorderCharts = (fromIndex: number, toIndex: number) => {
    const newConfigs = [...configs];
    const [moved] = newConfigs.splice(fromIndex, 1);
    newConfigs.splice(toIndex, 0, moved);
    saveConfigs(newConfigs);
  };

  return {
    configs,
    isLoaded,
    addChart,
    insertChart,
    updateChart,
    removeChart,
    clearAll,
    saveConfigs,
    reorderCharts,
    reload: loadConfigs,
  };
}
