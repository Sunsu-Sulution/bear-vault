"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChangeHistory {
  id: string;
  tabId: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: "create" | "update" | "delete" | "rename";
  entityType: "chart" | "tab";
  entityId: string;
  entityName: string;
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  timestamp: Date;
}

interface ChangeHistoryDialogProps {
  tabId: string;
}

export function ChangeHistoryDialog({ tabId }: ChangeHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChangeHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchHistory();
      // Refresh every 5 seconds when dialog is open
      const interval = setInterval(fetchHistory, 5000);
      return () => clearInterval(interval);
    }
  }, [open, tabId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/user-configs/change-history?tabId=${encodeURIComponent(tabId)}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Error fetching change history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAction = (action: string) => {
    switch (action) {
      case "create":
        return "สร้าง";
      case "update":
        return "แก้ไข";
      case "delete":
        return "ลบ";
      case "rename":
        return "เปลี่ยนชื่อ";
      default:
        return action;
    }
  };

  const formatEntityType = (type: string) => {
    return type === "chart" ? "กราฟ" : "แท็บ";
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="ประวัติการแก้ไข">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>ประวัติการแก้ไข</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading && history.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                ยังไม่มีการแก้ไข
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {item.userName || item.userEmail || item.userId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatAction(item.action)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatEntityType(item.entityType)}
                        </span>
                        <span className="text-xs font-medium">
                          {item.entityName}
                        </span>
                      </div>
                      {item.changes && item.changes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.changes.map((change, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-muted-foreground pl-4"
                            >
                              <span className="font-medium">{change.field}:</span>{" "}
                              <span className="line-through">
                                {String(change.oldValue || "-")}
                              </span>{" "}
                              →{" "}
                              <span className="font-medium">
                                {String(change.newValue || "-")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

