"use client";

import { useEffect, useState } from "react";
import { DashboardTab, DashboardTabsState, TabGroup } from "@/types/dashboard";
import { ChartConfigsState } from "@/types/chart";
import { recordChange } from "@/lib/record-change";

interface UseDashboardTabsOptions {
  userId?: string;
  userName?: string;
  userEmail?: string;
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
  return base || `tab-${Date.now()}`;
}

export function useDashboardTabs(options?: UseDashboardTabsOptions) {
  const [tabs, setTabs] = useState<DashboardTab[]>([]);
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadTabs = async () => {
    try {
      const response = await fetch("/api/user-configs/dashboard-tabs");
      if (response.ok) {
        const data = (await response.json()) as DashboardTabsState;
        if (data?.tabs) setTabs(data.tabs);
        if (data?.groups) setGroups(data.groups);
      }
    } catch (error) {
      console.error("Error loading dashboard tabs:", error);
    } finally {
    setIsLoaded(true);
    }
  };

  useEffect(() => {
    loadTabs();
  }, []);

  const save = async (nextTabs: DashboardTab[], nextGroups?: TabGroup[]) => {
    setTabs(nextTabs);
    if (nextGroups) setGroups(nextGroups);
    try {
      const response = await fetch("/api/user-configs/dashboard-tabs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          tabs: nextTabs,
          groups: nextGroups || groups,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save dashboard tabs");
      }
    } catch (error) {
      console.error("Error saving dashboard tabs:", error);
    }
  };

  const addTab = (name: string) => {
    let slug = slugify(name);
    // ensure unique
    let i = 1;
    const existing = new Set(tabs.map((t) => t.id));
    let unique = slug;
    while (existing.has(unique)) {
      unique = `${slug}-${i++}`;
    }
    const tab: DashboardTab = { 
      id: unique, 
      name, 
      createdAt: new Date().toISOString(),
      isPublic: false, // Default to private
    };
    save([...tabs, tab], groups);
    
    // Record change
    if (options?.userId) {
      recordChange({
        tabId: unique,
        userId: options.userId,
        userName: options.userName || options.userId,
        userEmail: options.userEmail || "",
        action: "create",
        entityType: "tab",
        entityId: unique,
        entityName: name,
      });
    }
    
    return tab.id;
  };

  const removeTab = (id: string) => {
    const tabToRemove = tabs.find((t) => t.id === id);
    save(tabs.filter((t) => t.id !== id), groups);
    
    // Record change
    if (options?.userId && tabToRemove) {
      recordChange({
        tabId: id,
        userId: options.userId,
        userName: options.userName || options.userId,
        userEmail: options.userEmail || "",
        action: "delete",
        entityType: "tab",
        entityId: id,
        entityName: tabToRemove.name,
      });
    }
  };

  const renameTab = (id: string, name: string) => {
    const oldTab = tabs.find((t) => t.id === id);
    save(tabs.map((t) => (t.id === id ? { ...t, name } : t)), groups);
    
    // Record change
    if (options?.userId && oldTab) {
      recordChange({
        tabId: id,
        userId: options.userId,
        userName: options.userName || options.userId,
        userEmail: options.userEmail || "",
        action: "rename",
        entityType: "tab",
        entityId: id,
        entityName: name,
        changes: [
          {
            field: "name",
            oldValue: oldTab.name,
            newValue: name,
          },
        ],
      });
    }
  };

  const updateTab = (id: string, updates: Partial<DashboardTab>) => {
    const oldTab = tabs.find((t) => t.id === id);
    if (!oldTab) return;
    
    const updatedTab = { ...oldTab, ...updates };
    save(tabs.map((t) => (t.id === id ? updatedTab : t)), groups);
    
    // Record change
    if (options?.userId) {
      const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
      if (updates.link !== undefined && updates.link !== oldTab.link) {
        changes.push({
          field: "link",
          oldValue: oldTab.link,
          newValue: updates.link,
        });
      }
      if (updates.icon !== undefined && updates.icon !== oldTab.icon) {
        changes.push({
          field: "icon",
          oldValue: oldTab.icon,
          newValue: updates.icon,
        });
      }
      
      if (changes.length > 0) {
        recordChange({
          tabId: id,
          userId: options.userId,
          userName: options.userName || options.userId,
          userEmail: options.userEmail || "",
          action: "update",
          entityType: "tab",
          entityId: id,
          entityName: oldTab.name,
          changes,
        });
      }
    }
  };

  const reorderTabs = (fromIndex: number, toIndex: number, groupId?: string) => {
    // Filter tabs by group
    const groupTabs = groupId 
      ? tabs.filter(t => t.groupId === groupId)
      : tabs.filter(t => !t.groupId);
    const otherTabs = groupId
      ? tabs.filter(t => t.groupId !== groupId)
      : tabs.filter(t => t.groupId);
    
    // Reorder within group
    const reorderedGroupTabs = [...groupTabs];
    const [moved] = reorderedGroupTabs.splice(fromIndex, 1);
    reorderedGroupTabs.splice(toIndex, 0, moved);
    
    // Combine back - maintain order: other tabs first, then group tabs
    const newTabs = [...otherTabs, ...reorderedGroupTabs];
    save(newTabs, groups);
  };

  const moveTabToGroup = (tabId: string, targetGroupId: string | null) => {
    const newTabs = tabs.map(t => 
      t.id === tabId ? { ...t, groupId: targetGroupId || undefined } : t
    );
    save(newTabs, groups);
  };

  const addGroup = (name: string) => {
    const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.order)) : -1;
    const newGroup: TabGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      order: maxOrder + 1,
    };
    save(tabs, [...groups, newGroup]);
    return newGroup.id;
  };

  const removeGroup = (groupId: string) => {
    // Move tabs from this group to uncategorized
    const newTabs = tabs.map(t => 
      t.groupId === groupId ? { ...t, groupId: undefined } : t
    );
    const newGroups = groups.filter(g => g.id !== groupId);
    save(newTabs, newGroups);
  };

  const renameGroup = (groupId: string, name: string) => {
    const newGroups = groups.map(g => 
      g.id === groupId ? { ...g, name } : g
    );
    save(tabs, newGroups);
  };

  const reorderGroups = (fromIndex: number, toIndex: number) => {
    const newGroups = [...groups];
    const [moved] = newGroups.splice(fromIndex, 1);
    newGroups.splice(toIndex, 0, moved);
    // Update order numbers
    const reorderedGroups = newGroups.map((g, idx) => ({ ...g, order: idx }));
    save(tabs, reorderedGroups);
  };

  const duplicateTab = async (id: string, desiredName?: string) => {
    const sourceTab = tabs.find((t) => t.id === id);
    if (!sourceTab) return null;

    // Create new tab name
    const baseName = (desiredName && desiredName.trim())
      ? desiredName.trim()
      : `${sourceTab.name} (Copy)`;
    let slug = slugify(baseName);
    // ensure unique
    let i = 1;
    const existing = new Set(tabs.map((t) => t.id));
    let unique = slug;
    while (existing.has(unique)) {
      unique = `${slug}-${i++}`;
    }
    const newTab: DashboardTab = {
      id: unique,
      name: baseName,
      createdAt: new Date().toISOString(),
      isPublic: false, // Default to private
      groupId: sourceTab.groupId, // Keep same group as source
    };

    // Save new tab
    save([...tabs, newTab], groups);
    
    // Record change
    if (options?.userId) {
      recordChange({
        tabId: unique,
        userId: options.userId,
        userName: options.userName || options.userId,
        userEmail: options.userEmail || "",
        action: "create",
        entityType: "tab",
        entityId: unique,
        entityName: baseName,
      });
    }

    // Copy charts from source tab to new tab
    try {
      const sourcePagePath = `/dashboard/${id}`;
      const targetPagePath = `/dashboard/${unique}`;

      // Fetch charts from source tab
      const sourceResponse = await fetch(
        `/api/user-configs/charts?pagePath=${encodeURIComponent(sourcePagePath)}`
      );
      if (sourceResponse.ok) {
        const sourceData = (await sourceResponse.json()) as ChartConfigsState;
        if (sourceData?.charts && sourceData.charts.length > 0) {
          // Generate new IDs for duplicated charts
          const duplicatedCharts = sourceData.charts.map((chart) => ({
            ...chart,
            id: `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          }));

          // Save charts to new tab
          await fetch("/api/user-configs/charts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pagePath: targetPagePath,
              charts: duplicatedCharts,
            }),
          });
        }
      }
    } catch (error) {
      console.error("Error duplicating charts:", error);
    }

    return newTab.id;
  };

  return { 
    tabs, 
    groups,
    isLoaded, 
    addTab, 
    removeTab, 
    renameTab, 
    updateTab,
    reorderTabs, 
    duplicateTab, 
    reloadTabs: loadTabs,
    moveTabToGroup,
    addGroup,
    removeGroup,
    renameGroup,
    reorderGroups,
  };
}


