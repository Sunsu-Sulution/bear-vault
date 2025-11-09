"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Note } from "@/app/api/user-configs/notes/route";

interface UseNotesOptions {
  tabId?: string;
}

export function useNotes(options?: UseNotesOptions) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  const tabId = options?.tabId;

  // Load notes from MongoDB
  useEffect(() => {
    if (typeof window === "undefined" || !tabId) {
      setIsLoaded(true);
      return;
    }

    // Reset hasLoadedRef when tabId changes
    hasLoadedRef.current = false;

    const loadNotes = async (isRefresh = false) => {
      try {
        const response = await fetch(
          `/api/user-configs/notes?tabId=${encodeURIComponent(tabId)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === "object" && Array.isArray(data.notes)) {
            setNotes((prevNotes) => {
              // Merge with existing notes to preserve local state (position, size, etc.)
              // but update emotes from server
              const merged = data.notes.map((serverNote: Note) => {
                const existingNote = prevNotes.find((n) => n.id === serverNote.id);
                if (existingNote) {
                  // Keep local state for position/size/content but update emotes
                  return {
                    ...existingNote,
                    emotes: serverNote.emotes || [],
                    updatedAt: serverNote.updatedAt,
                  };
                }
                return serverNote;
              });
              return merged;
            });
          }
        }
      } catch (error) {
        console.error("Error loading notes:", error);
      } finally {
        // Only set isLoaded to true once on initial load, never reset it
        if (!hasLoadedRef.current && !isRefresh) {
          setIsLoaded(true);
          hasLoadedRef.current = true;
        }
      }
    };

    loadNotes();

    // Listen for noteAdded events from other components
    const handleNoteAdded = (event: CustomEvent<{ note: Note; tabId: string }>) => {
      if (event.detail.tabId === tabId) {
        // Reload notes to sync with other components
        loadNotes(true); // Pass true to indicate this is a refresh, not initial load
      }
    };

    // Listen for reloadNotes events
    const handleReloadNotes = (event: CustomEvent<{ tabId: string }>) => {
      if (event.detail.tabId === tabId) {
        loadNotes(true); // Pass true to indicate this is a refresh, not initial load
      }
    };

    // Listen for noteEmoteUpdated events
    const handleNoteEmoteUpdated = (event: CustomEvent<{ noteId: string; emotes: Note["emotes"] }>) => {
      setNotes((prevNotes) => {
        return prevNotes.map((note) => {
          if (note.id === event.detail.noteId) {
            return {
              ...note,
              emotes: event.detail.emotes || [],
            };
          }
          return note;
        });
      });
    };

    window.addEventListener("noteAdded", handleNoteAdded as EventListener);
    window.addEventListener("reloadNotes", handleReloadNotes as EventListener);
    window.addEventListener("noteEmoteUpdated", handleNoteEmoteUpdated as EventListener);

    return () => {
      window.removeEventListener("noteAdded", handleNoteAdded as EventListener);
      window.removeEventListener("reloadNotes", handleReloadNotes as EventListener);
      window.removeEventListener("noteEmoteUpdated", handleNoteEmoteUpdated as EventListener);
    };
  }, [tabId]);

  // Save note
  const saveNote = useCallback(async (note: Note) => {
    if (typeof window === "undefined" || !tabId) {
      return;
    }

    try {
      const response = await fetch("/api/user-configs/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(note),
      });

      if (!response.ok) {
        throw new Error("Failed to save note");
      }

      const data = await response.json();
      const savedNote = data.note as Note;

      // Update state - only update if the note already exists (for updates)
      // For new notes added optimistically, just sync with server response
      setNotes((prev) => {
        const existingIndex = prev.findIndex((n) => n.id === savedNote.id);
        if (existingIndex >= 0) {
          // Update existing note
          const updated = [...prev];
          updated[existingIndex] = savedNote;
          return updated;
        }
        // Note doesn't exist yet - add it (shouldn't happen with optimistic update, but just in case)
        return [...prev, savedNote];
      });

      return savedNote;
    } catch (error) {
      console.error("Error saving note:", error);
      throw error;
    }
  }, [tabId]);

  // Add note
  const addNote = useCallback(
    async (note: Omit<Note, "id" | "createdAt" | "updatedAt">) => {
      if (!tabId) return;

      const newNote: Note = {
        ...note,
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Optimistic update: add to state immediately
      setNotes((prev) => {
        // Check if note already exists (shouldn't happen, but just in case)
        const exists = prev.some((n) => n.id === newNote.id);
        if (exists) {
          return prev;
        }
        return [...prev, newNote];
      });

      // Dispatch custom event to notify other components
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("noteAdded", { detail: { note: newNote, tabId } })
        );
      }

      try {
        await saveNote(newNote);
        return newNote.id;
      } catch (error) {
        // If save fails, remove the optimistic update
        setNotes((prev) => prev.filter((n) => n.id !== newNote.id));
        throw error;
      }
    },
    [tabId, saveNote]
  );

  // Update note
  const updateNote = useCallback(
    async (id: string, updates: Partial<Note>) => {
      const existingNote = notes.find((n) => n.id === id);
      if (!existingNote) return;

      const updatedNote: Note = {
        ...existingNote,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await saveNote(updatedNote);
    },
    [notes, saveNote]
  );

  // Remove note
  const removeNote = useCallback(
    async (id: string) => {
      if (typeof window === "undefined") {
        return;
      }

      try {
        const response = await fetch(
          `/api/user-configs/notes?id=${encodeURIComponent(id)}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete note");
        }

        setNotes((prev) => prev.filter((n) => n.id !== id));
      } catch (error) {
        console.error("Error deleting note:", error);
        throw error;
      }
    },
    []
  );

  return {
    notes,
    isLoaded,
    addNote,
    updateNote,
    removeNote,
    saveNote,
  };
}

