"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  X,
  Send,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHelperContext } from "./providers/helper-provider";
import { ChartRenderer } from "./chart-renderer";
import { ChartConfig } from "@/types/chart";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

type AISuggestedChart = {
  type: "table" | "bar" | "line" | "pie";
  title?: string;
  xAxisKey?: string;
  yAxisKey?: string;
  seriesKey?: string;
  groupByKey?: string;
  aggregate?: "sum" | "count" | "avg";
};

export interface ChatMessage {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  timestamp: string;
  tabId?: string;
  sqlQuery?: string; // Optional SQL query used for AI responses
  sqlColumns?: string[];
  connectionId?: string;
  database?: string;
  tabSuggestion?: string;
  originalQuestion?: string;
  suggestedCharts?: AISuggestedChart[];
  chartSummaries?: string[];
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  tabId?: string;
}

const POLL_INTERVAL = 2000; // Poll every 2 seconds
const MAX_MESSAGES = 100;

type GeminiResponse = {
  answer: string;
  sql: string | null;
  columns: string[];
  connectionId?: string;
  database?: string;
  tabSuggestion?: string;
  originalQuestion?: string;
  chartSuggestions: AISuggestedChart[];
  chartSummaries: string[];
};

const sanitizeToEnglish = (input: string, fallback: string): string => {
  const ascii = input
    .normalize("NFKD")
    .replace(/[^ -]/g, "")
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return ascii || fallback;
};

export function ChatPanel({ open, onClose, tabId }: ChatPanelProps) {
  const { userInfo } = useHelperContext()();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [chartData, setChartData] = useState<
    Record<
      string,
      {
        chart: ChartConfig;
        data: Record<string, unknown>[];
        columns: string[];
        isLoading: boolean;
      }
    >
  >({});
  const [pendingDashboard, setPendingDashboard] = useState<ChatMessage | null>(
    null,
  );
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<"append" | "new-tab">(
    "append",
  );
  const [newTabName, setNewTabName] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (pendingDashboard) {
      setDashboardMode("append");
      const suggestedName = sanitizeToEnglish(
        pendingDashboard.tabSuggestion ||
          pendingDashboard.originalQuestion ||
          "AI Dashboard",
        "AI Dashboard",
      ).slice(0, 80);
      setNewTabName(suggestedName);
    }
  }, [pendingDashboard]);

  const handleCreateDashboard = useCallback(async () => {
    if (!pendingDashboard || !pendingDashboard.sqlQuery) {
      return;
    }
    if (!pendingDashboard.connectionId || !pendingDashboard.database) {
      console.error("Missing connection info for dashboard generation");
      return;
    }

    const effectiveTabId = tabId || pendingDashboard.tabId;
    if (dashboardMode === "append" && !effectiveTabId) {
      alert("ไม่พบแท็บปัจจุบันสำหรับการเพิ่มกราฟ");
      return;
    }

    try {
      setIsCreatingDashboard(true);
      const suggestedTabLabel = sanitizeToEnglish(
        pendingDashboard.tabSuggestion ||
          pendingDashboard.originalQuestion ||
          "AI Generated Dashboard",
        "AI Generated Dashboard",
      ).slice(0, 80);

      const desiredNewTabName =
        dashboardMode === "new-tab"
          ? sanitizeToEnglish(
              newTabName ||
                pendingDashboard.tabSuggestion ||
                pendingDashboard.originalQuestion ||
                "AI Dashboard",
              "AI Dashboard",
            ).slice(0, 80)
          : undefined;

      const response = await fetch("/api/chat/generate-dashboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentTabId: effectiveTabId,
          mode: dashboardMode,
          tabName: suggestedTabLabel,
          targetTabName: desiredNewTabName,
          sql: pendingDashboard.sqlQuery,
          columns: pendingDashboard.sqlColumns || [],
          connectionId: pendingDashboard.connectionId,
          database: pendingDashboard.database,
          question: pendingDashboard.originalQuestion || "",
          chartSuggestions: pendingDashboard.suggestedCharts || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create dashboard");
      }

      const result = await response.json().catch(() => ({}));

      const targetTabId =
        dashboardMode === "new-tab"
          ? typeof result?.tabId === "string"
            ? result.tabId
            : undefined
          : effectiveTabId;

      if (typeof window !== "undefined" && targetTabId) {
        window.dispatchEvent(
          new CustomEvent("charts:refresh", {
            detail: { pagePath: `/dashboard/${targetTabId}` },
          }),
        );
      }

      setPendingDashboard(null);
      if (
        dashboardMode === "new-tab" &&
        result?.tabId &&
        typeof result.tabId === "string"
      ) {
        router.push(`/dashboard/${result.tabId}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Error creating dashboard:", error);
      alert(
        error instanceof Error
          ? error.message
          : "มีข้อผิดพลาดในการสร้าง Dashboard",
      );
    } finally {
      setIsCreatingDashboard(false);
      setDashboardMode("append");
    }
  }, [dashboardMode, newTabName, pendingDashboard, router, tabId]);

  const userId = userInfo?.user_id || userInfo?.email || "";
  const userName = userInfo?.name || userInfo?.en_name || userId;
  const userEmail = userInfo?.email || "";

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setShowScrollButton(false);
    }
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(
    async (sinceLastId = false) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (tabId) {
          params.append("tabId", tabId);
        }
        params.append("limit", MAX_MESSAGES.toString());

        // Use current lastMessageId from state
        const currentLastMessageId = lastMessageId;
        if (sinceLastId && currentLastMessageId) {
          params.append("lastMessageId", currentLastMessageId);
        }

        const response = await fetch(`/api/chat?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();
        const newMessages = data.messages as ChatMessage[];

        if (sinceLastId && currentLastMessageId) {
          // Only add new messages (not already in state)
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m._id));
            const uniqueNewMessages = newMessages.filter(
              (m) => !existingIds.has(m._id),
            );
            return [...prev, ...uniqueNewMessages].slice(-MAX_MESSAGES);
          });
        } else {
          // Set all messages (initial load)
          setMessages(newMessages);
        }

        // Update lastMessageId to the most recent message
        if (newMessages.length > 0) {
          const latestMessage = newMessages[newMessages.length - 1];
          setLastMessageId(latestMessage._id);
          // Only scroll to bottom on initial load, not during polling
          if (!sinceLastId) {
            scrollToBottom();
          }
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [tabId, lastMessageId, scrollToBottom],
  );

  // Call Gemini API to get answer
  const callGemini = useCallback(
    async (question: string): Promise<GeminiResponse> => {
      try {
        // Clean question - remove /ai or /ask prefix if present
        const cleanQuestion = question
          .replace(/^\/ai\s+/i, "")
          .replace(/^\/ask\s+/i, "")
          .trim();

        const response = await fetch("/api/chat/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: cleanQuestion }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to get AI response");
        }

        const data = await response.json();
        const rawChartSuggestions: unknown[] = Array.isArray(
          data.chartSuggestions,
        )
          ? data.chartSuggestions
          : [];
        const chartSuggestions: AISuggestedChart[] = rawChartSuggestions
          .map((chart) => {
            if (!chart || typeof chart !== "object") return null;
            const obj = chart as Record<string, unknown>;
            const type = obj.type;
            if (
              type !== "table" &&
              type !== "bar" &&
              type !== "line" &&
              type !== "pie"
            ) {
              return null;
            }
            return {
              type,
              title: typeof obj.title === "string" ? obj.title : undefined,
              xAxisKey:
                typeof obj.xAxisKey === "string" ? obj.xAxisKey : undefined,
              yAxisKey:
                typeof obj.yAxisKey === "string" ? obj.yAxisKey : undefined,
              seriesKey:
                typeof obj.seriesKey === "string" ? obj.seriesKey : undefined,
              groupByKey:
                typeof obj.groupByKey === "string" ? obj.groupByKey : undefined,
              aggregate:
                obj.aggregate === "sum" ||
                obj.aggregate === "count" ||
                obj.aggregate === "avg"
                  ? obj.aggregate
                  : undefined,
            } as AISuggestedChart;
          })
          .filter((chart): chart is AISuggestedChart => chart !== null);

        const chartSummaries: string[] = Array.isArray(data.chartSummaries)
          ? data.chartSummaries
              .map((item: unknown) =>
                typeof item === "string" ? item : String(item),
              )
              .filter((item: string) => item.trim().length > 0)
          : [];

        return {
          answer: data.answer || "ไม่สามารถสร้างคำตอบได้",
          sql: data.sql || null,
          columns: Array.isArray(data.columns)
            ? (data.columns as string[])
            : [],
          connectionId:
            typeof data.connectionId === "string"
              ? data.connectionId
              : undefined,
          database:
            typeof data.database === "string" ? data.database : undefined,
          tabSuggestion:
            typeof data.tabSuggestion === "string"
              ? data.tabSuggestion
              : undefined,
          originalQuestion:
            typeof data.originalQuestion === "string"
              ? data.originalQuestion
              : cleanQuestion,
          chartSuggestions,
          chartSummaries,
        };
      } catch (error) {
        console.error("Error calling Gemini:", error);
        throw error;
      }
    },
    [],
  );

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !userId || isSending) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "60px";
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userName,
          userEmail,
          message: messageText,
          tabId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      const newMessage = data.message as ChatMessage;

      // Add message to state immediately
      setMessages((prev) => [...prev, newMessage].slice(-MAX_MESSAGES));
      setLastMessageId(newMessage._id);
      scrollToBottom();

      // Always call Gemini and add AI response
      setIsAiTyping(true);
      scrollToBottom(); // Scroll to show typing indicator

      try {
        const geminiResponse = await callGemini(messageText);

        // Save AI response as a message with SQL query
        const aiResponse = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "ai-assistant",
            userName: "AI Assistant",
            userEmail: "",
            message: geminiResponse.answer,
            sqlQuery: geminiResponse.sql || undefined,
            sqlColumns: geminiResponse.columns,
            connectionId: geminiResponse.connectionId,
            database: geminiResponse.database,
            tabSuggestion: geminiResponse.tabSuggestion,
            originalQuestion: geminiResponse.originalQuestion,
            suggestedCharts: geminiResponse.chartSuggestions,
            chartSummaries: geminiResponse.chartSummaries,
            tabId,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiMessage = aiData.message as ChatMessage;
          // Add SQL query to the message
          if (geminiResponse.sql) {
            aiMessage.sqlQuery = geminiResponse.sql;
          }
          if (geminiResponse.columns) {
            aiMessage.sqlColumns = geminiResponse.columns;
          }
          if (geminiResponse.connectionId) {
            aiMessage.connectionId = geminiResponse.connectionId;
          }
          if (geminiResponse.database) {
            aiMessage.database = geminiResponse.database;
          }
          if (geminiResponse.tabSuggestion) {
            aiMessage.tabSuggestion = geminiResponse.tabSuggestion;
          }
          if (geminiResponse.originalQuestion) {
            aiMessage.originalQuestion = geminiResponse.originalQuestion;
          }
          if (geminiResponse.chartSuggestions?.length) {
            aiMessage.suggestedCharts = geminiResponse.chartSuggestions;
          }
          if (geminiResponse.chartSummaries?.length) {
            aiMessage.chartSummaries = geminiResponse.chartSummaries;
          }
          setMessages((prev) => [...prev, aiMessage].slice(-MAX_MESSAGES));
          setLastMessageId(aiMessage._id);
          scrollToBottom();
        }
      } catch (aiError) {
        console.error("Error getting AI response:", aiError);
        const errorMessage = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "ai-assistant",
            userName: "AI Assistant",
            userEmail: "",
            message: `ขออภัย ไม่สามารถสร้างคำตอบได้: ${
              aiError instanceof Error ? aiError.message : "Unknown error"
            }`,
            tabId,
          }),
        });

        if (errorMessage.ok) {
          const errorData = await errorMessage.json();
          const errorMsg = errorData.message as ChatMessage;
          setMessages((prev) => [...prev, errorMsg].slice(-MAX_MESSAGES));
          setLastMessageId(errorMsg._id);
          scrollToBottom();
        }
      } finally {
        setIsAiTyping(false);
      }

      // Polling will pick up the message automatically
    } catch (error) {
      console.error("Error sending message:", error);
      // Restore input message on error
      setInputMessage(messageText);
    } finally {
      setIsSending(false);
    }
  }, [
    inputMessage,
    userId,
    userName,
    userEmail,
    tabId,
    isSending,
    scrollToBottom,
    callGemini,
  ]);

  // Prevent body scroll when chat panel is open
  useEffect(() => {
    if (open) {
      // Disable body scroll
      document.body.style.overflow = "hidden";
    } else {
      // Re-enable body scroll
      document.body.style.overflow = "";
    }
    return () => {
      // Cleanup: re-enable body scroll when component unmounts
      document.body.style.overflow = "";
    };
  }, [open]);

  // Initial load
  useEffect(() => {
    if (open) {
      setLastMessageId(null); // Reset when opening
      fetchMessages(false);
      setShowScrollButton(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Only fetch when panel opens

  // Poll for new messages when panel is open
  useEffect(() => {
    if (!open || !userId) return;

    // Start polling after initial load completes
    const startPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(() => {
        fetchMessages(true);
      }, POLL_INTERVAL);
    };

    // Wait a bit for initial load, then start polling
    const timer = setTimeout(startPolling, 1000);

    return () => {
      clearTimeout(timer);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]); // Only re-run when panel opens/closes or user changes

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200,
      )}px`;
    }
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter -> force insert newline at caret
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const { selectionStart, selectionEnd } = el;
      const before = inputMessage.slice(
        0,
        selectionStart ?? inputMessage.length,
      );
      const after = inputMessage.slice(selectionEnd ?? inputMessage.length);
      const next = `${before}\n${after}`;
      setInputMessage(next);
      // Restore caret position after newline
      requestAnimationFrame(() => {
        try {
          const pos = (selectionStart ?? 0) + 1;
          el.selectionStart = pos;
          el.selectionEnd = pos;
        } catch {}
        adjustTextareaHeight();
      });
      return;
    }

    // Enter (without modifier) -> send
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }
    // Shift+Enter -> newline (default behavior)
  };

  // Adjust textarea height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage, adjustTextareaHeight]);

  // Track scroll position to toggle scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const threshold = 160;
      setShowScrollButton(
        scrollHeight - (scrollTop + clientHeight) > threshold,
      );
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [messages.length, open]);

  // Scroll to bottom when AI starts typing
  useEffect(() => {
    if (isAiTyping) {
      scrollToBottom();
    }
  }, [isAiTyping, scrollToBottom]);

  // Extract URLs from text
  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Check if URL is a chart link
  const isChartLink = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Check if it's a public chart link: /public/chart/[chartId]
      const chartMatch = pathname.match(/\/public\/chart\/([^\/]+)/);
      if (chartMatch) {
        return chartMatch[1];
      }
      return null;
    } catch {
      return null;
    }
  };

  // Fetch chart data
  const fetchChartData = useCallback(async (chartId: string) => {
    // Set loading state
    setChartData((prev) => {
      // Check if already loaded or loading
      if (prev[chartId] && !prev[chartId].isLoading) {
        return prev;
      }
      return {
        ...prev,
        [chartId]: {
          chart: {} as ChartConfig,
          data: [],
          columns: [],
          isLoading: true,
        },
      };
    });

    try {
      const response = await fetch(`/api/public/chart/${chartId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch chart");
      }

      const data = await response.json();
      if (data.chart && data.data) {
        setChartData((prev) => ({
          ...prev,
          [chartId]: {
            chart: data.chart as ChartConfig,
            data: data.data as Record<string, unknown>[],
            columns: data.columns as string[],
            isLoading: false,
          },
        }));
      }
    } catch (error) {
      console.error("Error fetching chart:", error);
      setChartData((prev) => ({
        ...prev,
        [chartId]: {
          chart: {} as ChartConfig,
          data: [],
          columns: [],
          isLoading: false,
        },
      }));
    }
  }, []);

  // Check for chart links in messages and fetch them
  useEffect(() => {
    messages.forEach((msg) => {
      const urls = extractUrls(msg.message);
      urls.forEach((url) => {
        const chartId = isChartLink(url);
        if (chartId) {
          fetchChartData(chartId);
        }
      });
    });
  }, [messages, fetchChartData]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return "เพิ่งเมื่อกี้";
    } else if (diffMins < 60) {
      return `${diffMins} นาทีที่แล้ว`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} ชั่วโมงที่แล้ว`;
    } else {
      return date.toLocaleString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-300 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Chat Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-300 w-full sm:w-auto sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl bg-background border-l shadow-lg transition-transform duration-300 ease-in-out",
          "flex flex-col",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="font-semibold">แชท</h2>
            {tabId && (
              <span className="text-xs text-muted-foreground">({tabId})</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="relative flex-1 overflow-y-auto p-4"
        >
          <div className="space-y-3">
            {isLoading && messages.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <p>ยังไม่มีข้อความ</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwnMessage = msg.userId === userId;
                return (
                  <div
                    key={msg._id}
                    className={cn(
                      "flex flex-col gap-1",
                      isOwnMessage ? "items-end" : "items-start",
                    )}
                  >
                    {!isOwnMessage && (
                      <span className="text-xs text-muted-foreground px-2">
                        {msg.userName}
                      </span>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 max-w-[80%] wrap-break-word",
                        isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm whitespace-pre-wrap",
                          isOwnMessage ? "text-primary-foreground" : "",
                        )}
                      >
                        {msg.userId === "ai-assistant" ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-0.5 last:mb-0 leading-relaxed">
                                  {children}
                                </p>
                              ),
                              h1: ({ children }) => (
                                <h1 className="text-lg font-semibold mb-0.5 mt-1 first:mt-0">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-base font-semibold mb-0.5 mt-1 first:mt-0">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-semibold mb-0.5 mt-1 first:mt-0">
                                  {children}
                                </h3>
                              ),
                              strong: ({ children }) => (
                                <strong
                                  className={cn(
                                    "font-semibold",
                                    isOwnMessage
                                      ? "text-primary-foreground"
                                      : "text-foreground",
                                  )}
                                >
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em
                                  className={cn(
                                    "italic",
                                    isOwnMessage
                                      ? "text-primary-foreground/90"
                                      : "",
                                  )}
                                >
                                  {children}
                                </em>
                              ),
                              code: ({ children, className }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code
                                    className={cn(
                                      "px-1 py-0.5 rounded text-xs font-mono",
                                      isOwnMessage
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : "bg-muted-foreground/20 text-foreground",
                                    )}
                                  >
                                    {children}
                                  </code>
                                ) : (
                                  <code
                                    className={cn(
                                      "block p-2 rounded text-xs font-mono overflow-x-auto my-0.5",
                                      isOwnMessage
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : "bg-muted-foreground/20 text-foreground",
                                    )}
                                  >
                                    {children}
                                  </code>
                                );
                              },
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside mb-0.5 space-y-0">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside mb-0.5 space-y-0">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="ml-1 leading-relaxed">
                                  {children}
                                </li>
                              ),
                              a: ({ href, children }) => {
                                const url = href || "";
                                const chartId = isChartLink(url);
                                if (chartId) {
                                  return <>{children}</>;
                                }
                                return (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "underline hover:opacity-80",
                                      isOwnMessage
                                        ? "text-primary-foreground/90"
                                        : "text-blue-500 hover:text-blue-600",
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(
                                        url,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    }}
                                  >
                                    {children}
                                  </a>
                                );
                              },
                            }}
                          >
                            {msg.message}
                          </ReactMarkdown>
                        ) : (
                          // Use original rendering for user messages (with URL support)
                          msg.message.split("\n").map((line, lineIdx) => {
                            const urls = extractUrls(line);
                            if (urls.length === 0) {
                              return (
                                <React.Fragment key={lineIdx}>
                                  {line}
                                  {lineIdx <
                                    msg.message.split("\n").length - 1 && (
                                    <br />
                                  )}
                                </React.Fragment>
                              );
                            }
                            let lastIndex = 0;
                            const parts: React.ReactNode[] = [];
                            urls.forEach((url, urlIdx) => {
                              const urlIndex = line.indexOf(url, lastIndex);
                              if (urlIndex > lastIndex) {
                                parts.push(line.substring(lastIndex, urlIndex));
                              }
                              parts.push(
                                <a
                                  key={`${lineIdx}-${urlIdx}`}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "underline hover:opacity-80",
                                    isOwnMessage
                                      ? "text-primary-foreground/90"
                                      : "text-blue-500 hover:text-blue-600",
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                      url,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }}
                                >
                                  {url}
                                </a>,
                              );
                              lastIndex = urlIndex + url.length;
                            });
                            if (lastIndex < line.length) {
                              parts.push(line.substring(lastIndex));
                            }
                            return (
                              <React.Fragment key={lineIdx}>
                                {parts}
                                {lineIdx <
                                  msg.message.split("\n").length - 1 && <br />}
                              </React.Fragment>
                            );
                          })
                        )}
                      </div>
                      {/* Chart previews - show only charts, no link cards */}
                      {extractUrls(msg.message).filter((url) =>
                        isChartLink(url),
                      ).length > 0 && (
                        <div className="mt-2 space-y-2">
                          {extractUrls(msg.message)
                            .filter((url) => isChartLink(url))
                            .map((url, idx) => {
                              const chartId = isChartLink(url);
                              const chartInfo = chartId
                                ? chartData[chartId]
                                : null;

                              if (!chartId || !chartInfo) return null;

                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "rounded-lg border overflow-hidden",
                                    isOwnMessage
                                      ? "bg-primary-foreground/5 border-primary-foreground/20"
                                      : "bg-background border-border",
                                  )}
                                >
                                  {chartInfo.isLoading ? (
                                    <div className="flex items-center justify-center p-8">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                    </div>
                                  ) : chartInfo.chart.id ? (
                                    <div className="p-2">
                                      <ChartRenderer
                                        config={chartInfo.chart}
                                        data={chartInfo.data}
                                        isLoading={false}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                        </div>
                      )}
                      {/* Regular link previews - exclude chart links */}
                      {extractUrls(msg.message).filter(
                        (url) => !isChartLink(url),
                      ).length > 0 && (
                        <div className="mt-2 space-y-2">
                          {extractUrls(msg.message)
                            .filter((url) => !isChartLink(url))
                            .map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded border text-xs transition-colors",
                                  isOwnMessage
                                    ? "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20"
                                    : "bg-background border-border text-foreground hover:bg-accent",
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    url,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }}
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate flex-1">{url}</span>
                              </a>
                            ))}
                        </div>
                      )}
                      {msg.sqlQuery &&
                        msg.userId === "ai-assistant" &&
                        msg.connectionId &&
                        msg.database && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              onClick={() => setPendingDashboard({ ...msg })}
                              size="sm"
                              className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-purple-500 via-pink-500 to-orange-500 text-white shadow-sm transition-transform duration-200 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 hover:shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-300"
                            >
                              <Sparkles className="h-4 w-4" />
                              <span>Use AI Report</span>
                            </Button>
                          </div>
                        )}
                      <span
                        className={cn(
                          "text-xs mt-1 block",
                          isOwnMessage
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            {/* AI Typing Indicator */}
            {isAiTyping && (
              <div className="flex flex-col gap-1 items-start">
                <span className="text-xs text-muted-foreground px-2">
                  AI Assistant
                </span>
                <div className="rounded-lg px-3 py-2 bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      กำลังพิมพ์
                    </span>
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {showScrollButton && (
          <div className="px-4 pb-2">
            <Button
              onClick={scrollToBottom}
              size="icon"
              variant="secondary"
              className="ml-auto flex rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              disabled={isSending || !userId}
              className="flex-1 min-h-[60px] max-h-[200px] resize-none overflow-y-auto"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isSending || !userId}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            กด Enter เพื่อส่ง หรือกด Ctrl/Cmd + Enter เพื่อขึ้นบรรทัดใหม่
            <br />
            AI จะตอบคำถามทุกข้อความที่คุณส่ง
          </p>
        </div>
      </div>
      <Dialog
        open={!!pendingDashboard}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDashboard(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Use AI Report</DialogTitle>
            <DialogDescription>
              เลือกว่าจะให้ AI เพิ่มรายงานที่สร้างจากคำถามล่าสุดไว้ที่ไหน
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingDashboard?.originalQuestion && (
              <div className="rounded border bg-muted/30 p-3 text-xs">
                <div className="font-medium text-muted-foreground mb-1">
                  คำถามของคุณ
                </div>
                <p className="leading-relaxed text-foreground/80">
                  {pendingDashboard.originalQuestion}
                </p>
              </div>
            )}
            {pendingDashboard?.chartSummaries &&
              pendingDashboard.chartSummaries.length > 0 && (
                <div className="rounded border bg-muted/20 p-3 text-xs space-y-1">
                  <div className="font-medium text-muted-foreground mb-1">
                    AI จะสร้างรายงานเหล่านี้
                  </div>
                  <ul className="space-y-1 list-disc pl-4 text-foreground/80">
                    {pendingDashboard.chartSummaries.map((summary, idx) => (
                      <li key={idx}>{summary}</li>
                    ))}
                  </ul>
                </div>
              )}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                เลือกปลายทาง
              </div>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setDashboardMode("append")}
                  className={cn(
                    "rounded-lg border p-3 text-left text-xs transition-colors",
                    dashboardMode === "append"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                  disabled={isCreatingDashboard}
                >
                  <div className="font-semibold text-sm text-foreground">
                    เพิ่มลงในแท็บปัจจุบัน
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI จะเพิ่มกราฟไว้ท้ายแท็บนี้ทันที
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardMode("new-tab")}
                  className={cn(
                    "rounded-lg border p-3 text-left text-xs transition-colors",
                    dashboardMode === "new-tab"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                  disabled={isCreatingDashboard}
                >
                  <div className="font-semibold text-sm text-foreground">
                    สร้างแท็บใหม่
                  </div>
                  <p className="text-xs text-muted-foreground">
                    เริ่มหน้า Dashboard ใหม่จากรายงานชุดนี้
                  </p>
                </button>
              </div>
            </div>
            {dashboardMode === "new-tab" && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  ชื่อแท็บใหม่ (ภาษาอังกฤษเท่านั้น)
                </div>
                <Input
                  value={newTabName}
                  onChange={(event) => setNewTabName(event.target.value)}
                  placeholder="Sales Overview"
                  maxLength={80}
                  disabled={isCreatingDashboard}
                />
                <p className="text-[11px] text-muted-foreground/80">
                  ระบบจะปรับชื่อให้อยู่ในรูปแบบภาษาอังกฤษอัตโนมัติ
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingDashboard(null)}
              disabled={isCreatingDashboard}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreateDashboard}
              disabled={isCreatingDashboard}
            >
              {isCreatingDashboard ? "กำลังสร้าง..." : "ยืนยัน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
