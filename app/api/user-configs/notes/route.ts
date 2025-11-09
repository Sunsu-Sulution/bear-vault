import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const COLLECTION_NAME = "notes";

export interface NoteEmote {
  userId: string;
  userName: string;
  emote: string;
}

export interface Note {
  id: string;
  tabId: string;
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  color?: string; // Optional: note color (default: yellow)
  createdBy: string;
  createdByName?: string; // Optional: user's display name
  emotes?: NoteEmote[]; // Optional: array of emotes/reactions
  createdAt: string;
  updatedAt: string;
}

// GET /api/user-configs/notes?tabId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get("tabId");

    if (!tabId) {
      return NextResponse.json(
        { error: "tabId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const notes = await collection
      .find({ tabId })
      .sort({ createdAt: 1 })
      .toArray();

    // Convert _id and dates to strings
    const formattedNotes = notes.map((note) => ({
      id: note.id,
      tabId: note.tabId,
      content: note.content,
      position: note.position,
      size: note.size,
      color: note.color || "yellow", // Default to yellow if not set
      createdBy: note.createdBy,
      createdByName: note.createdByName || note.createdBy,
      emotes: note.emotes || [], // Default to empty array if not set
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    }));

    return NextResponse.json({ notes: formattedNotes });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST /api/user-configs/notes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      tabId,
      content,
      position,
      size,
      color,
      createdBy,
      createdByName,
      emotes,
    }: {
      id: string;
      tabId: string;
      content: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      color?: string;
      createdBy: string;
      createdByName?: string;
      emotes?: NoteEmote[];
    } = body;

    if (!id || !tabId || !createdBy) {
      return NextResponse.json(
        { error: "id, tabId, and createdBy are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const now = new Date();
    const note: Note = {
      id,
      tabId,
      content: content || "",
      position: position || { x: 100, y: 100 },
      size: size || { width: 300, height: 200 },
      color: color || "yellow", // Default to yellow if not set
      createdBy,
      createdByName: createdByName || createdBy,
      emotes: emotes || [], // Default to empty array if not set
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await collection.updateOne(
      { id },
      {
        $set: {
          ...note,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Error saving note:", error);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    );
  }
}

// DELETE /api/user-configs/notes?id=...
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    await collection.deleteOne({ id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}

