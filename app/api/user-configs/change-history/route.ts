import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const COLLECTION_NAME = "change_history";

export interface ChangeHistory {
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

// Get change history for a tab
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tabId = searchParams.get("tabId");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!tabId) {
      return NextResponse.json(
        { error: "Missing tabId parameter" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const history = await collection
      .find({ tabId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    const changeHistory = history.map((h) => ({
      id: h._id.toString(),
      tabId: h.tabId,
      userId: h.userId,
      userName: h.userName,
      userEmail: h.userEmail,
      action: h.action,
      entityType: h.entityType,
      entityId: h.entityId,
      entityName: h.entityName,
      changes: h.changes || [],
      timestamp: h.timestamp,
    }));

    return NextResponse.json({ history: changeHistory });
  } catch (error) {
    console.error("Error getting change history:", error);
    return NextResponse.json(
      { error: "Failed to get change history" },
      { status: 500 }
    );
  }
}

// Record a change
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tabId,
      userId,
      userName,
      userEmail,
      action,
      entityType,
      entityId,
      entityName,
      changes,
    } = body;

    if (!tabId || !userId || !action || !entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const changeRecord: Omit<ChangeHistory, "id"> = {
      tabId,
      userId,
      userName: userName || userId,
      userEmail: userEmail || "",
      action,
      entityType,
      entityId,
      entityName: entityName || entityId,
      changes: changes || [],
      timestamp: new Date(),
    };

    await collection.insertOne(changeRecord);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording change:", error);
    return NextResponse.json(
      { error: "Failed to record change" },
      { status: 500 }
    );
  }
}

