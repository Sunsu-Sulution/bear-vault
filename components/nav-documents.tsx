"use client";
import { type Icon } from "@tabler/icons-react";
import { IconX, IconPencil, IconCopy } from "@tabler/icons-react";
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

export function NavDocuments({
  items,
  label = "Dashboard",
  onDelete,
  onRename,
  onDuplicate,
  onReorder,
}: {
  items: {
    id?: string;
    name: string;
    url: string;
    icon: Icon;
  }[];
  label?: string;
  onDelete?: (id: string, url: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}) {
  const { router, isLocked } = useHelperContext()();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item, index) => {
          const isEditing = editingId === item.id;
          const isDragging = draggedIndex === index;
          return (
            <SidebarMenuItem key={item.id || item.name}>
              <SidebarMenuButton asChild>
                <div
                  className={`flex items-center justify-between w-full group ${
                    isDragging ? "opacity-50" : ""
                  }`}
                  draggable={!!onReorder && !isEditing && !isLocked}
                  onDragStart={(e) => {
                    if (isLocked) return;
                    if (onReorder && item.id) {
                      setDraggedIndex(index);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", item.id);
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = "0.5";
                      }
                    }
                  }}
                  onDragEnd={(e) => {
                    if (e.currentTarget instanceof HTMLElement) {
                      e.currentTarget.style.opacity = "1";
                    }
                    setDraggedIndex(null);
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
                    const draggedItemIndex = items.findIndex(
                      (i) => i.id === draggedId,
                    );
                    if (
                      draggedItemIndex !== -1 &&
                      draggedItemIndex !== index
                    ) {
                      onReorder(draggedItemIndex, index);
                    }
                    setDraggedIndex(null);
                  }}
                >
                  <div
                    className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                    onClick={() => {
                      if (!isEditing) {
                        router.push(item.url);
                      }
                    }}
                  >
                    <item.icon className="shrink-0" />
                    {isEditing ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleEditSave(item.id!);
                          } else if (e.key === "Escape") {
                            handleEditCancel();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate">{item.name}</span>
                    )}
                  </div>
                  {!isEditing && (onDelete || onRename || onDuplicate) && item.id && !isLocked && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-40 transition-opacity">
                      {onDuplicate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate(item.id!);
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
                            handleEditStart(item.id!, item.name);
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
                            if (confirm(`คุณต้องการลบ "${item.name}" หรือไม่?`)) {
                              onDelete(item.id!, item.url);
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
                          handleEditSave(item.id!);
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
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
