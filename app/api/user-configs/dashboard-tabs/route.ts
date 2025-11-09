import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { DashboardTab, DashboardTabsState, TabGroup } from "@/types/dashboard";

const COLLECTION_NAME = "dashboard_tabs";

// GET /api/user-configs/dashboard-tabs
export async function GET() {
  try {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const doc = await collection.findOne({ id: "default" });
    if (!doc) {
      return NextResponse.json({ tabs: [], groups: [] } as DashboardTabsState);
    }

    return NextResponse.json({ 
      tabs: doc.tabs || [], 
      groups: doc.groups || [] 
    } as DashboardTabsState);
  } catch (error) {
    console.error("Error fetching dashboard tabs:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard tabs" },
      { status: 500 }
    );
  }
}

// POST /api/user-configs/dashboard-tabs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabs, groups } = body as { tabs: DashboardTab[]; groups?: TabGroup[] };

    if (!Array.isArray(tabs)) {
      return NextResponse.json(
        { error: "tabs must be an array" },
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
          tabs,
          groups: groups || [],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving dashboard tabs:", error);
    return NextResponse.json(
      { error: "Failed to save dashboard tabs" },
      { status: 500 }
    );
  }
}

