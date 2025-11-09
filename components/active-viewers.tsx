"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActiveViewer {
  userId: string;
  userName: string;
  userEmail: string;
  lastSeen: Date;
}

interface ActiveViewersProps {
  tabId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
}

export function ActiveViewers({
  tabId,
  currentUserId,
  currentUserName,
  currentUserEmail,
}: ActiveViewersProps) {
  const [viewers, setViewers] = useState<ActiveViewer[]>([]);

  // Send heartbeat to track this user as active
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch("/api/user-configs/active-viewers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tabId,
            userId: currentUserId,
            userName: currentUserName,
            userEmail: currentUserEmail,
          }),
        });
      } catch (error) {
        console.error("Error sending heartbeat:", error);
      }
    };

    // Send heartbeat immediately and then every 10 seconds
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 10000);

    return () => clearInterval(interval);
  }, [tabId, currentUserId, currentUserName, currentUserEmail]);

  // Fetch active viewers
  useEffect(() => {
    const fetchActiveViewers = async () => {
      try {
        const response = await fetch(
          `/api/user-configs/active-viewers?tabId=${encodeURIComponent(tabId)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setViewers(data.viewers || []);
        }
      } catch (error) {
        console.error("Error fetching active viewers:", error);
      }
    };

    // Fetch immediately and then every 5 seconds
    fetchActiveViewers();
    const interval = setInterval(fetchActiveViewers, 5000);

    return () => clearInterval(interval);
  }, [tabId]);

  // Get unique viewers (include current user)
  const uniqueViewers = viewers.filter(
    (v, index, self) => index === self.findIndex((t) => t.userId === v.userId),
  );

  if (uniqueViewers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{uniqueViewers.length} คนกำลังดู</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="z-[250]">
          <div className="space-y-1">
            {uniqueViewers.map((viewer) => (
              <div key={viewer.userId} className="text-sm">
                {viewer.userId === currentUserId ? (
                  <span className="font-semibold">
                    {viewer.userName || viewer.userEmail || viewer.userId} (คุณ)
                  </span>
                ) : (
                  viewer.userName || viewer.userEmail || viewer.userId
                )}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
