import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { NoteEmote } from "../route";

const COLLECTION_NAME = "notes";

// PATCH /api/user-configs/notes/emote
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      noteId,
      userId,
      userName,
      emote,
      action, // "add" or "remove"
    }: {
      noteId: string;
      userId: string;
      userName: string;
      emote: string;
      action: "add" | "remove";
    } = body;

    if (!noteId || !userId || !emote || !action) {
      return NextResponse.json(
        { error: "noteId, userId, emote, and action are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const note = await collection.findOne({ id: noteId });
    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    const currentEmotes = (note.emotes || []) as NoteEmote[];
    let updatedEmotes: NoteEmote[];

    if (action === "add") {
      // Remove existing emote from this user if any, then add new one
      updatedEmotes = [
        ...currentEmotes.filter((e) => e.userId !== userId),
        { userId, userName, emote },
      ];
    } else {
      // Remove emote from this user
      updatedEmotes = currentEmotes.filter((e) => e.userId !== userId);
    }

    const now = new Date();
    await collection.updateOne(
      { id: noteId },
      {
        $set: {
          emotes: updatedEmotes,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      emotes: updatedEmotes,
    });
  } catch (error) {
    console.error("Error updating note emote:", error);
    return NextResponse.json(
      { error: "Failed to update note emote" },
      { status: 500 }
    );
  }
}

