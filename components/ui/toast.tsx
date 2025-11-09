"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  open: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, open, onClose, duration = 2000 }: ToastProps) {
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg",
        "animate-in fade-in slide-in-from-bottom-2",
      )}
    >
      <span>{message}</span>
    </div>
  );
}

