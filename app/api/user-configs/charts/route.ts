import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ChartConfig, ChartConfigsState } from "@/types/chart";

const COLLECTION_NAME = "chart_configs";

// GET /api/user-configs/charts?pagePath=...
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pagePath = searchParams.get("pagePath");

    if (!pagePath) {
      return NextResponse.json(
        { error: "pagePath is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const doc = await collection.findOne({ pagePath });
    if (!doc) {
      return NextResponse.json({ charts: [] } as ChartConfigsState);
    }

    return NextResponse.json({ charts: doc.charts || [] } as ChartConfigsState);
  } catch (error) {
    console.error("Error fetching chart configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart configs" },
      { status: 500 }
    );
  }
}

// POST /api/user-configs/charts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pagePath, charts } = body as {
      pagePath: string;
      charts: ChartConfig[];
    };

    if (!pagePath) {
      return NextResponse.json(
        { error: "pagePath is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    await collection.updateOne(
      { pagePath },
      {
        $set: {
          pagePath,
          charts: charts || [],
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving chart configs:", error);
    return NextResponse.json(
      { error: "Failed to save chart configs" },
      { status: 500 }
    );
  }
}

