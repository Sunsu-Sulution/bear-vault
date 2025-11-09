"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";
import { useParams } from "next/navigation";

export function FloatingChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const params = useParams<{ tab?: string }>();
  const tabId = params.tab as string | undefined;

  return (
    <>
      <Button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-12 px-5 rounded-full shadow-lg",
          "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500",
          "hover:from-purple-600 hover:via-pink-600 hover:to-orange-600",
          "hover:shadow-xl hover:shadow-purple-500/50",
          "transition-all duration-300",
          "flex items-center gap-2",
          "group",
          "hover:scale-105 active:scale-95",
          "text-white font-semibold"
        )}
      >
        <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
        <span className="text-base">Ask AI</span>
      </Button>
      <ChatPanel
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        tabId={tabId}
      />
    </>
  );
}

