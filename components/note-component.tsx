"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X, GripVertical, Palette, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Note, NoteEmote } from "@/app/api/user-configs/notes/route";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHelperContext } from "@/components/providers/helper-provider";

// Color definitions
const NOTE_COLORS = {
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-300 dark:border-yellow-700",
    headerBorder: "border-yellow-300 dark:border-yellow-700",
    text: "text-yellow-700 dark:text-yellow-300",
    textSecondary: "text-yellow-600 dark:text-yellow-400",
    resizeHandle: "bg-yellow-300 dark:bg-yellow-700",
    resizeHandleBorder: "border-yellow-600 dark:border-yellow-400",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-300 dark:border-blue-700",
    headerBorder: "border-blue-300 dark:border-blue-700",
    text: "text-blue-700 dark:text-blue-300",
    textSecondary: "text-blue-600 dark:text-blue-400",
    resizeHandle: "bg-blue-300 dark:bg-blue-700",
    resizeHandleBorder: "border-blue-600 dark:border-blue-400",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-300 dark:border-green-700",
    headerBorder: "border-green-300 dark:border-green-700",
    text: "text-green-700 dark:text-green-300",
    textSecondary: "text-green-600 dark:text-green-400",
    resizeHandle: "bg-green-300 dark:bg-green-700",
    resizeHandleBorder: "border-green-600 dark:border-green-400",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-900/20",
    border: "border-pink-300 dark:border-pink-700",
    headerBorder: "border-pink-300 dark:border-pink-700",
    text: "text-pink-700 dark:text-pink-300",
    textSecondary: "text-pink-600 dark:text-pink-400",
    resizeHandle: "bg-pink-300 dark:bg-pink-700",
    resizeHandleBorder: "border-pink-600 dark:border-pink-400",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-300 dark:border-purple-700",
    headerBorder: "border-purple-300 dark:border-purple-700",
    text: "text-purple-700 dark:text-purple-300",
    textSecondary: "text-purple-600 dark:text-purple-400",
    resizeHandle: "bg-purple-300 dark:bg-purple-700",
    resizeHandleBorder: "border-purple-600 dark:border-purple-400",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-300 dark:border-orange-700",
    headerBorder: "border-orange-300 dark:border-orange-700",
    text: "text-orange-700 dark:text-orange-300",
    textSecondary: "text-orange-600 dark:text-orange-400",
    resizeHandle: "bg-orange-300 dark:bg-orange-700",
    resizeHandleBorder: "border-orange-600 dark:border-orange-400",
  },
} as const;

type NoteColor = keyof typeof NOTE_COLORS;

interface NoteComponentProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  isLocked?: boolean;
  currentUserId?: string;
  currentUserName?: string;
}

export function NoteComponent({
  note,
  onUpdate,
  onDelete,
  currentUserId,
  currentUserName,
}: NoteComponentProps) {
  const { userInfo } = useHelperContext()();
  const effectiveUserName = currentUserName || userInfo?.name || userInfo?.en_name || currentUserId || "";
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const noteRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use derived state for content, position, size, and color
  // Only use local state for editing (content) and dragging/resizing (position, size)
  const [localContent, setLocalContent] = useState(note.content);
  const [localPosition, setLocalPosition] = useState(note.position);
  const [localSize, setLocalSize] = useState(note.size);
  const noteColor = (note.color as NoteColor) || "yellow";
  const [localColor, setLocalColor] = useState<NoteColor>(noteColor);
  const [localEmotes, setLocalEmotes] = useState<NoteEmote[]>(note.emotes || []);

  // Sync local state with props when props change (but not when user is editing/dragging/resizing)
  const prevNoteRef = useRef(note);
  const isEditingRef = useRef(false);
  const isTransitioningRef = useRef(false);

  // Sync state from props - this is a valid use case for useEffect
  // We need to sync local state when props change from external source
  // Note: This is a controlled component pattern - syncing props to local state
  useEffect(() => {
    // Skip sync if transitioning between mobile/desktop
    if (isTransitioningRef.current) return;

    const prevNote = prevNoteRef.current;
    // Only sync content if props changed from external source (not from local editing)
    if (
      prevNote.content !== note.content &&
      !isDragging &&
      !isResizing &&
      !isEditingRef.current
    ) {
      setLocalContent(note.content);
    }
    if (
      (prevNote.position.x !== note.position.x ||
        prevNote.position.y !== note.position.y) &&
      !isDragging
    ) {
      setLocalPosition(note.position);
    }
    if (
      (prevNote.size.width !== note.size.width ||
        prevNote.size.height !== note.size.height) &&
      !isResizing
    ) {
      setLocalSize(note.size);
    }
    const newColor = (note.color as NoteColor) || "yellow";
    const prevColor = (prevNote.color as NoteColor) || "yellow";
    if (newColor !== prevColor) {
      setLocalColor(newColor);
    }
    // Sync emotes
    const newEmotes = note.emotes || [];
    const prevEmotes = prevNote.emotes || [];
    if (JSON.stringify(newEmotes) !== JSON.stringify(prevEmotes)) {
      setLocalEmotes(newEmotes);
    }
    prevNoteRef.current = note;
  }, [note, isDragging, isResizing]);

  // Get color styles
  const colorStyles = NOTE_COLORS[localColor] || NOTE_COLORS.yellow;

  // Handle window resize/zoom to recalculate position if needed
  useEffect(() => {
    const handleResize = () => {
      // Debounce resize handling to avoid excessive updates
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        // When window resizes or zooms, the container rect changes
        // But note position is relative to container, so it should stay correct
        // We just need to ensure the note is still within bounds
        let container: HTMLElement | null = null;
        let current: HTMLElement | null = noteRef.current;
        while (current && !container) {
          if (
            current.hasAttribute &&
            current.hasAttribute("data-content-container")
          ) {
            container = current;
            break;
          }
          current = current.parentElement;
        }

        if (container) {
          const containerRect = container.getBoundingClientRect();

          // On mobile, adjust note size if needed
          const maxWidth = isMobile
            ? Math.min(containerRect.width - 20, 300)
            : 800;
          const maxHeight = isMobile
            ? Math.min(containerRect.height - 20, 400)
            : 600;

          // Use note size from props as base, not localSize which might be adjusted
          const baseWidth = note.size.width;
          const baseHeight = note.size.height;

          // Ensure note size is within bounds
          const adjustedWidth = Math.min(baseWidth, maxWidth);
          const adjustedHeight = Math.min(baseHeight, maxHeight);

          // Use note position from props as base
          const baseX = note.position.x;
          const baseY = note.position.y;

          // Ensure note is still within container bounds
          // If container is smaller than note position, adjust proportionally
          let newX = baseX;
          let newY = baseY;

          // If note is outside container bounds, adjust it
          if (baseX + adjustedWidth > containerRect.width) {
            // If container is wider now, keep relative position
            // Otherwise, move note to fit
            newX = Math.max(0, containerRect.width - adjustedWidth);
          } else if (baseX < 0) {
            newX = 0;
          }

          if (baseY + adjustedHeight > containerRect.height) {
            newY = Math.max(0, containerRect.height - adjustedHeight);
          } else if (baseY < 0) {
            newY = 0;
          }

          // Only update if position or size actually changed
          // IMPORTANT: Don't save position or size changes to database when resizing window
          // Only update local state for display purposes
          // Position and size should only be saved when user explicitly drags/resizes the note
          if (
            newX !== localPosition.x ||
            newY !== localPosition.y ||
            adjustedWidth !== localSize.width ||
            adjustedHeight !== localSize.height
          ) {
            setLocalPosition({ x: newX, y: newY });
            if (
              adjustedWidth !== localSize.width ||
              adjustedHeight !== localSize.height
            ) {
              setLocalSize({ width: adjustedWidth, height: adjustedHeight });
            }
            // Don't save position or size changes from window resize
            // Position and size will be restored from props when window size changes
            // They should only be saved when user explicitly drags or resizes
          }
        }
      }, 150); // Debounce 150ms
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [
    localPosition,
    localSize,
    note.id,
    note.position.x,
    note.position.y,
    note.size.width,
    note.size.height,
    onUpdate,
    isMobile,
  ]);

  // Handle mobile/desktop transition separately to ensure proper recalculation
  const prevIsMobileRef = useRef(isMobile);
  useEffect(() => {
    // Only recalculate when isMobile actually changes
    if (prevIsMobileRef.current === isMobile) return;

    prevIsMobileRef.current = isMobile;
    isTransitioningRef.current = true;

    // When switching between mobile and desktop, recalculate position
    const handleMobileTransition = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        let container: HTMLElement | null = null;
        let current: HTMLElement | null = noteRef.current;
        while (current && !container) {
          if (
            current.hasAttribute &&
            current.hasAttribute("data-content-container")
          ) {
            container = current;
            break;
          }
          current = current.parentElement;
        }

        if (container) {
          // Force update to use original values from props
          // IMPORTANT: Don't save position or size changes when transitioning between mobile/desktop
          // Always use original position and size from props to ensure correct values
          // Position and size should only be saved when user explicitly drags/resizes
          const originalX = note.position.x;
          const originalY = note.position.y;
          const originalWidth = note.size.width;
          const originalHeight = note.size.height;

          // Use original values from props, not calculated values
          setLocalPosition({ x: originalX, y: originalY });
          setLocalSize({ width: originalWidth, height: originalHeight });

          // Don't save any changes during transition
          // The note will use its original saved position and size

          // Reset transition flag after a delay
          setTimeout(() => {
            isTransitioningRef.current = false;
          }, 300);
        } else {
          isTransitioningRef.current = false;
        }
      }, 200); // Slightly longer delay for mobile transition
    };

    handleMobileTransition();
  }, [
    isMobile,
    note.id,
    note.position.x,
    note.position.y,
    note.size.width,
    note.size.height,
    onUpdate,
  ]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localContent]);

  const isOwner = currentUserId === note.createdBy;

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile) return; // Disable dragging on mobile
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      // Get container bounds for relative positioning
      // Find the container with data-content-container attribute
      let container: HTMLElement | null = null;
      let current: HTMLElement | null = noteRef.current;
      while (current && !container) {
        if (
          current.hasAttribute &&
          current.hasAttribute("data-content-container")
        ) {
          container = current;
          break;
        }
        current = current.parentElement;
      }

      const containerRect = container?.getBoundingClientRect();

      if (containerRect) {
        // Calculate dragStart relative to container
        // Use current mouse position relative to container
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        // dragStart is the offset from mouse to note's top-left corner
        setDragStart({
          x: mouseX - localPosition.x,
          y: mouseY - localPosition.y,
        });
      } else {
        // Fallback: calculate relative to viewport
        setDragStart({
          x: e.clientX - localPosition.x,
          y: e.clientY - localPosition.y,
        });
      }
    },
    [localPosition, isMobile],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!isOwner || isMobile) return; // Only owner can resize, and disable on mobile
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      // Get container bounds for relative positioning
      let container: HTMLElement | null = null;
      let current: HTMLElement | null = noteRef.current;
      while (current && !container) {
        if (
          current.hasAttribute &&
          current.hasAttribute("data-content-container")
        ) {
          container = current;
          break;
        }
        current = current.parentElement;
      }

      const containerRect = container?.getBoundingClientRect();

      if (containerRect) {
        // Store resize start relative to container
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        setResizeStart({
          x: mouseX,
          y: mouseY,
          width: localSize.width,
          height: localSize.height,
        });
      } else {
        // Fallback: use viewport coordinates
        setResizeStart({
          x: e.clientX,
          y: e.clientY,
          width: localSize.width,
          height: localSize.height,
        });
      }
    },
    [isOwner, localSize, isMobile],
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Get container bounds for relative positioning
        // Find the container with data-content-container attribute
        let container: HTMLElement | null = null;
        let current: HTMLElement | null = noteRef.current;
        while (current && !container) {
          if (
            current.hasAttribute &&
            current.hasAttribute("data-content-container")
          ) {
            container = current;
            break;
          }
          current = current.parentElement;
        }

        const containerRect = container?.getBoundingClientRect();

        if (containerRect) {
          // Calculate position relative to container
          // Get fresh mouse position relative to container (handles zoom changes)
          const mouseX = e.clientX - containerRect.left;
          const mouseY = e.clientY - containerRect.top;

          // Calculate new position using dragStart offset
          const relativeX = mouseX - dragStart.x;
          const relativeY = mouseY - dragStart.y;

          // Constrain to container bounds
          // Note: container already starts after sidebar, so we don't need to account for sidebar width
          const newX = Math.max(
            0, // Start from left edge of container (which is already after sidebar)
            Math.min(containerRect.width - localSize.width, relativeX),
          );
          const newY = Math.max(
            0, // Start from top of container
            Math.min(containerRect.height - localSize.height, relativeY),
          );

          setLocalPosition({ x: newX, y: newY });
        } else {
          // Fallback to viewport-based positioning
          const newX = Math.max(
            0,
            Math.min(
              window.innerWidth - localSize.width,
              e.clientX - dragStart.x,
            ),
          );
          const newY = Math.max(
            0,
            Math.min(
              window.innerHeight - localSize.height,
              e.clientY - dragStart.y,
            ),
          );
          setLocalPosition({ x: newX, y: newY });
        }
      } else if (isResizing) {
        // Get container bounds for relative positioning
        let container: HTMLElement | null = null;
        let current: HTMLElement | null = noteRef.current;
        while (current && !container) {
          if (
            current.hasAttribute &&
            current.hasAttribute("data-content-container")
          ) {
            container = current;
            break;
          }
          current = current.parentElement;
        }

        const containerRect = container?.getBoundingClientRect();

        if (containerRect) {
          // Calculate resize delta relative to container
          const mouseX = e.clientX - containerRect.left;
          const mouseY = e.clientY - containerRect.top;
          const deltaX = mouseX - resizeStart.x;
          const deltaY = mouseY - resizeStart.y;

          const newWidth = Math.max(
            200,
            Math.min(800, resizeStart.width + deltaX),
          );
          const newHeight = Math.max(
            100,
            Math.min(600, resizeStart.height + deltaY),
          );

          // Ensure resize doesn't push note outside container bounds
          const maxWidth = containerRect.width - localPosition.x;
          const maxHeight = containerRect.height - localPosition.y;
          const constrainedWidth = Math.min(newWidth, maxWidth);
          const constrainedHeight = Math.min(newHeight, maxHeight);

          setLocalSize({
            width: Math.max(200, constrainedWidth),
            height: Math.max(100, constrainedHeight),
          });
        } else {
          // Fallback: use viewport coordinates
          const deltaX = e.clientX - resizeStart.x;
          const deltaY = e.clientY - resizeStart.y;
          const newWidth = Math.max(
            200,
            Math.min(800, resizeStart.width + deltaX),
          );
          const newHeight = Math.max(
            100,
            Math.min(600, resizeStart.height + deltaY),
          );
          setLocalSize({ width: newWidth, height: newHeight });
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onUpdate(note.id, { position: localPosition });
      } else if (isResizing) {
        setIsResizing(false);
        onUpdate(note.id, { size: localSize });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    dragStart,
    resizeStart,
    localPosition,
    localSize,
    note.id,
    onUpdate,
  ]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      isEditingRef.current = true;
      setLocalContent(newContent);
      // Reset editing flag after a short delay
      setTimeout(() => {
        isEditingRef.current = false;
      }, 100);
    },
    [],
  );

  const handleContentBlur = useCallback(() => {
    if (localContent !== note.content) {
      onUpdate(note.id, { content: localContent });
    }
  }, [localContent, note.content, note.id, onUpdate]);

  const handleColorChange = useCallback(
    (color: NoteColor) => {
      setLocalColor(color);
      onUpdate(note.id, { color });
    },
    [note.id, onUpdate],
  );

  const handleDelete = useCallback(() => {
    if (confirm("ต้องการลบ note นี้หรือไม่?")) {
      onDelete(note.id);
    }
  }, [note.id, onDelete]);

  // Emote handling
  const handleEmote = useCallback(
    async (emote: string) => {
      if (!currentUserId || !effectiveUserName) return;

      const currentEmotes = localEmotes;
      const userEmote = currentEmotes.find((e) => e.userId === currentUserId);
      const action = userEmote?.emote === emote ? "remove" : "add";

      try {
        const response = await fetch("/api/user-configs/notes/emote", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            noteId: note.id,
            userId: currentUserId,
            userName: effectiveUserName,
            emote,
            action,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setLocalEmotes(data.emotes);
          onUpdate(note.id, { emotes: data.emotes });
          
          // Dispatch event to notify other components
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("noteEmoteUpdated", {
                detail: { noteId: note.id, emotes: data.emotes },
              })
            );
          }
        }
      } catch (error) {
        console.error("Error updating emote:", error);
      }
    },
    [note.id, localEmotes, currentUserId, effectiveUserName, onUpdate]
  );

  // Common emotes
  const COMMON_EMOTES = ["👍", "❤️", "😊", "🎉", "🔥", "👏", "💯", "✨"];

  // Group emotes by emote value
  const emotesByValue = localEmotes.reduce(
    (acc, emote) => {
      if (!acc[emote.emote]) {
        acc[emote.emote] = [];
      }
      acc[emote.emote].push(emote);
      return acc;
    },
    {} as Record<string, NoteEmote[]>
  );

  const userEmote = localEmotes.find((e) => e.userId === currentUserId);

  return (
    <div
      ref={noteRef}
      className={cn(
        "absolute border-2 rounded-lg shadow-lg",
        "flex flex-col",
        colorStyles.bg,
        colorStyles.border,
        isDragging && "cursor-move",
        isResizing && "cursor-nwse-resize",
        isMobile && "max-w-[calc(100vw-40px)]", // Responsive max width on mobile
      )}
      style={{
        left: `${localPosition.x}px`,
        top: `${localPosition.y}px`,
        width:
          isMobile && typeof window !== "undefined"
            ? `${Math.min(localSize.width, window.innerWidth - 40)}px`
            : `${localSize.width}px`,
        minHeight: `${localSize.height}px`,
        maxWidth: isMobile ? "calc(100vw - 40px)" : "800px",
        zIndex: isDragging || isResizing ? 50 : 20,
      }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-2 border-b",
          colorStyles.headerBorder,
          !isMobile && "cursor-move", // Only show cursor-move on desktop
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical
            className={cn("h-4 w-4 shrink-0", colorStyles.textSecondary)}
          />
          <span
            className={cn("text-xs font-medium shrink-0", colorStyles.text)}
          >
            Note
          </span>
          {note.createdByName && (
            <span className={cn("text-xs truncate", colorStyles.textSecondary)}>
              โดย {note.createdByName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOwner && !isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Palette
                    className={cn("h-3 w-3", colorStyles.textSecondary)}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.keys(NOTE_COLORS).map((color) => (
                  <DropdownMenuItem
                    key={color}
                    onClick={() => handleColorChange(color as NoteColor)}
                    className="gap-2"
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2",
                        NOTE_COLORS[color as NoteColor].bg,
                        NOTE_COLORS[color as NoteColor].border,
                      )}
                    />
                    <span className="capitalize">{color}</span>
                    {localColor === color && (
                      <span className="ml-auto text-xs">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleDelete}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3" onMouseDown={(e) => e.stopPropagation()}>
        {isOwner && !isMobile ? (
          <Textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleContentChange}
            onBlur={handleContentBlur}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="พิมพ์ข้อความ..."
            className="w-full min-h-[60px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm"
            style={{ height: "auto" }}
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap wrap-break-word">
            {localContent || (
              <span className="text-muted-foreground">ไม่มีข้อความ</span>
            )}
          </div>
        )}
      </div>

      {/* Emotes Section */}
      {currentUserId && (
        <div className={cn("px-3 pb-2 border-t", colorStyles.headerBorder)}>
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {/* Display Emotes */}
            {Object.keys(emotesByValue).length > 0 ? (
              Object.entries(emotesByValue).map(([emote, users]) => (
                <Tooltip key={emote}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "h-7 px-2 rounded border flex items-center justify-center transition-colors gap-1",
                        colorStyles.border,
                        "hover:bg-accent/50",
                        userEmote?.emote === emote && "bg-accent/50"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEmote(emote);
                      }}
                    >
                      <span className="text-lg leading-none">{emote}</span>
                      <span className={cn("text-xs font-medium", colorStyles.text)}>
                        {users.length}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      {users.map((u) => u.userName).join(", ")}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))
            ) : (
              // Show add emote button only when there are no emotes
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-7 w-7 rounded hover:bg-accent/50 flex items-center justify-center transition-colors shrink-0 opacity-50 hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="p-2 grid grid-cols-4 gap-1">
                    {COMMON_EMOTES.map((emote) => (
                      <button
                        key={emote}
                        onClick={() => handleEmote(emote)}
                        className={cn(
                          "p-2 rounded hover:bg-accent text-lg transition-colors",
                          userEmote?.emote === emote && "bg-accent"
                        )}
                      >
                        {emote}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Add Emote Button - show next to emotes */}
            {Object.keys(emotesByValue).length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-7 w-7 rounded hover:bg-accent/50 flex items-center justify-center transition-colors shrink-0 opacity-50 hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="p-2 grid grid-cols-4 gap-1">
                    {COMMON_EMOTES.map((emote) => (
                      <button
                        key={emote}
                        onClick={() => handleEmote(emote)}
                        className={cn(
                          "p-2 rounded hover:bg-accent text-lg transition-colors",
                          userEmote?.emote === emote && "bg-accent"
                        )}
                      >
                        {emote}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Resize handle - only for owner and desktop */}
      {isOwner && !isMobile && (
        <div
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize rounded-tl-lg",
            colorStyles.resizeHandle,
          )}
          onMouseDown={handleResizeStart}
        >
          <div className="w-full h-full flex items-end justify-end p-1">
            <div
              className={cn(
                "w-2 h-2 border-r-2 border-b-2",
                colorStyles.resizeHandleBorder,
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
