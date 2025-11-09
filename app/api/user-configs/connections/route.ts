import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { DbConnection } from "@/hooks/use-connections";

const COLLECTION_NAME = "db_connections";

type State = {
  connections: DbConnection[];
  activeId?: string;
};

// GET /api/user-configs/connections
export async function GET() {
  try {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const doc = await collection.findOne({ id: "default" });
    if (!doc) {
      return NextResponse.json({
        connections: [],
        activeId: undefined,
      } as State);
    }

    return NextResponse.json({
      connections: doc.connections || [],
      activeId: doc.activeId,
    } as State);
  } catch (error) {
    console.error("Error fetching connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// POST /api/user-configs/connections
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connections, activeId } = body as State;

    if (!Array.isArray(connections)) {
      return NextResponse.json(
        { error: "connections must be an array" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    await collection.updateOne(
      { id: "default" },
      {
        $set: {
          id: "default",
          connections,
          activeId,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving connections:", error);
    return NextResponse.json(
      { error: "Failed to save connections" },
      { status: 500 }
    );
  }
}

