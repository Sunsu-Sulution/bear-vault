"use client";
import { type Icon } from "@tabler/icons-react";
import {
  IconX,
  IconPencil,
  IconCopy,
  IconPlus,
  IconFolder,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { useState } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useHelperContext } from "./providers/helper-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardTab, TabGroup } from "@/types/dashboard";

interface NavDocumentsWithGroupsProps {
  tabs: DashboardTab[];
  groups: TabGroup[];
  icon: Icon;
  onDelete?: (id: string, url: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number, groupId?: string) => void;
  onMoveTabToGroup?: (tabId: string, targetGroupId: string | null) => void;
  onAddGroup?: (name: string) => void;
  onRemoveGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onReorderGroups?: (fromIndex: number, toIndex: number) => void;
}

export function NavDocumentsWithGroups({
  tabs,
  groups,
  icon: TabIcon,
  onDelete,
  onRename,
  onDuplicate,
  onReorder,
  onMoveTabToGroup,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onReorderGroups,
}: NavDocumentsWithGroupsProps) {
  const { router, isLocked } = useHelperContext()();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  // Sort groups by order
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const isGroupCollapsed = (groupId: string) => collapsedGroups.has(groupId);

  // Get tabs for each group
  const tabsByGroup = sortedGroups.reduce((acc, group) => {
    acc[group.id] = tabs.filter((t) => t.groupId === group.id);
    return acc;
  }, {} as Record<string, DashboardTab[]>);

  // Get uncategorized tabs
  const uncategorizedTabs = tabs.filter((t) => !t.groupId);

  const handleEditStart = (id: string, name: string) => {
    if (isLocked) return;
    setEditingId(id);
    setEditName(name);
  };

  const handleEditSave = (id: string) => {
    if (editName.trim() && onRename) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleGroupEditStart = (groupId: string, name: string) => {
    if (isLocked) return;
    setEditingGroupId(groupId);
    setEditGroupName(name);
  };

  const handleGroupEditSave = (groupId: string) => {
    if (editGroupName.trim() && onRenameGroup) {
      onRenameGroup(groupId, editGroupName.trim());
    }
    setEditingGroupId(null);
    setEditGroupName("");
  };

  const handleGroupEditCancel = () => {
    setEditingGroupId(null);
    setEditGroupName("");
  };

  const handleAddGroup = () => {
    if (isLocked || !onAddGroup) return;
    const name = prompt("ชื่อกลุ่มใหม่");
    if (name && name.trim()) {
      onAddGroup(name.trim());
    }
  };

  const renderTabItem = (
    tab: DashboardTab,
    index: number,
    groupId?: string,
  ) => {
    const isEditing = editingId === tab.id;
    const isDragging = draggedTabId === tab.id;
    const url = `/dashboard/${tab.id}`;

    return (
      <SidebarMenuItem key={tab.id}>
        <SidebarMenuButton asChild>
          <div
            className={`flex items-center justify-between w-full group ${
              isDragging ? "opacity-50" : ""
            }`}
            draggable={!!onReorder && !isEditing && !isLocked}
            onDragStart={(e) => {
              if (isLocked) return;
              if (onReorder && tab.id) {
                setDraggedTabId(tab.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", tab.id);
                e.dataTransfer.setData("application/group", groupId || "");
                if (e.currentTarget instanceof HTMLElement) {
                  e.currentTarget.style.opacity = "0.5";
                }
              }
            }}
            onDragEnd={(e) => {
              if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = "1";
              }
              setDraggedTabId(null);
              setDragOverGroupId(null);
            }}
            onDragOver={(e) => {
              if (!onReorder || isEditing || isLocked) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              if (!onReorder || isEditing || isLocked) return;
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/plain");
              const sourceGroupId = e.dataTransfer.getData("application/group");

              // If moving between groups, use moveTabToGroup
              if (sourceGroupId !== (groupId || "")) {
                if (onMoveTabToGroup) {
                  onMoveTabToGroup(draggedId, groupId || null);
                }
              } else {
                // Reorder within same group
                const groupTabs = groupId
                  ? tabsByGroup[groupId] || []
                  : uncategorizedTabs;
                const draggedItemIndex = groupTabs.findIndex(
                  (t) => t.id === draggedId,
                );

                if (draggedItemIndex !== -1 && draggedItemIndex !== index) {
                  onReorder(draggedItemIndex, index, groupId);
                }
              }
              setDraggedTabId(null);
              setDragOverGroupId(null);
            }}
          >
            <div
              className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
              onClick={() => {
                if (!isEditing) {
                  router.push(url);
                }
              }}
            >
              <TabIcon className="shrink-0" />
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleEditSave(tab.id);
                    } else if (e.key === "Escape") {
                      handleEditCancel();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 text-sm"
                  autoFocus
                />
              ) : (
                <span className="truncate">{tab.name}</span>
              )}
            </div>
            {!isEditing &&
              (onDelete || onRename || onDuplicate) &&
              tab.id &&
              !isLocked && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-40 transition-opacity">
                  {onDuplicate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(tab.id);
                      }}
                      title="Duplicate"
                    >
                      <IconCopy className="h-3 w-3" />
                    </Button>
                  )}
                  {onRename && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStart(tab.id, tab.name);
                      }}
                    >
                      <IconPencil className="h-3 w-3" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive cursor-pointer opacity-60 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`คุณต้องการลบ "${tab.name}" หรือไม่?`)) {
                          onDelete(tab.id, url);
                        }
                      }}
                    >
                      <IconX className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            {isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 cursor-pointer opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSave(tab.id);
                  }}
                >
                  ✓
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 cursor-pointer opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditCancel();
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      {/* Groups */}
      {sortedGroups.map((group, groupIndex) => {
        const groupTabs = tabsByGroup[group.id] || [];
        const isGroupEditing = editingGroupId === group.id;

        return (
          <SidebarGroup
            key={group.id}
            className="group-data-[collapsible=icon]:hidden"
          >
            <div
              className="flex items-center justify-between px-2 py-1"
              draggable={!!onReorderGroups && !isGroupEditing && !isLocked}
              onDragStart={(e) => {
                if (isLocked) return;
                if (onReorderGroups) {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/group-id", group.id);
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = "0.5";
                  }
                }
              }}
              onDragEnd={(e) => {
                if (e.currentTarget instanceof HTMLElement) {
                  e.currentTarget.style.opacity = "1";
                }
              }}
              onDragOver={(e) => {
                if (!onReorderGroups || isGroupEditing || isLocked) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                if (!onReorderGroups || isGroupEditing || isLocked) return;
                e.preventDefault();
                const draggedId = e.dataTransfer.getData(
                  "application/group-id",
                );
                const draggedIndex = sortedGroups.findIndex(
                  (g) => g.id === draggedId,
                );
                if (draggedIndex !== -1 && draggedIndex !== groupIndex) {
                  onReorderGroups(draggedIndex, groupIndex);
                }
              }}
            >
              {isGroupEditing ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleGroupEditSave(group.id);
                      } else if (e.key === "Escape") {
                        handleGroupEditCancel();
                      }
                    }}
                    className="h-6 text-sm flex-1"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleGroupEditSave(group.id)}
                  >
                    ✓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleGroupEditCancel}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(group.id);
                      }}
                    >
                      {isGroupCollapsed(group.id) ? (
                        <IconChevronRight className="h-4 w-4" />
                      ) : (
                        <IconChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <SidebarGroupLabel
                      className="flex items-center gap-1 flex-1 cursor-pointer"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <IconFolder className="h-4 w-4" />
                      {group.name}
                    </SidebarGroupLabel>
                  </div>
                  {!isLocked && (onRenameGroup || onRemoveGroup) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-40 transition-opacity">
                      {onRenameGroup && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGroupEditStart(group.id, group.name);
                          }}
                        >
                          <IconPencil className="h-3 w-3" />
                        </Button>
                      )}
                      {onRemoveGroup && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive opacity-60 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `คุณต้องการลบกลุ่ม "${group.name}" หรือไม่?`,
                              )
                            ) {
                              onRemoveGroup(group.id);
                            }
                          }}
                        >
                          <IconX className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {!isGroupCollapsed(group.id) && (
              <SidebarMenu>
                {groupTabs.map((tab, tabIndex) =>
                  renderTabItem(tab, tabIndex, group.id),
                )}
                {/* Drop zone for moving tabs to this group */}
                {!isLocked && onMoveTabToGroup && (
                  <div
                    className={`px-2 py-1 border-2 border-dashed rounded transition-colors ${
                      dragOverGroupId === group.id
                        ? "border-primary bg-primary/10"
                        : "border-transparent"
                    }`}
                    onDragOver={(e) => {
                      if (draggedTabId && draggedTabId !== group.id) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverGroupId(group.id);
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverGroupId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData("text/plain");
                      if (draggedId && onMoveTabToGroup) {
                        onMoveTabToGroup(draggedId, group.id);
                      }
                      setDraggedTabId(null);
                      setDragOverGroupId(null);
                    }}
                  >
                    <span className="text-xs text-muted-foreground">
                      วางแท็บที่นี่
                    </span>
                  </div>
                )}
              </SidebarMenu>
            )}
          </SidebarGroup>
        );
      })}

      {/* Uncategorized tabs */}
      {uncategorizedTabs.length > 0 && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Uncategorized</SidebarGroupLabel>
          <SidebarMenu>
            {uncategorizedTabs.map((tab, index) => renderTabItem(tab, index))}
            {/* Drop zone for moving tabs to uncategorized */}
            {!isLocked && onMoveTabToGroup && (
              <div
                className={`px-2 py-1 border-2 border-dashed rounded transition-colors ${
                  dragOverGroupId === null
                    ? "border-primary bg-primary/10"
                    : "border-transparent"
                }`}
                onDragOver={(e) => {
                  if (draggedTabId) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverGroupId(null);
                  }
                }}
                onDragLeave={() => {
                  setDragOverGroupId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  if (draggedId && onMoveTabToGroup) {
                    onMoveTabToGroup(draggedId, null);
                  }
                  setDraggedTabId(null);
                  setDragOverGroupId(null);
                }}
              >
                <span className="text-xs text-muted-foreground">
                  วางแท็บที่นี่
                </span>
              </div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {/* Add Group Button */}
      {!isLocked && onAddGroup && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleAddGroup}
          >
            <IconPlus className="h-4 w-4 mr-2" />
            เพิ่มกลุ่ม
          </Button>
        </SidebarGroup>
      )}
    </>
  );
}
