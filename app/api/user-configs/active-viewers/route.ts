import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const COLLECTION_NAME = "active_viewers";

// Clean up inactive viewers (older than 30 seconds)
async function cleanupInactiveViewers() {
    try {
        const db = await getDb();
        const collection = db.collection(COLLECTION_NAME);
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
        await collection.deleteMany({
            lastSeen: { $lt: thirtySecondsAgo },
        });
    } catch (error) {
        console.error("Error cleaning up inactive viewers:", error);
    }
}

// Track active viewer
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tabId, userId, userName, userEmail } = body;

        if (!tabId || !userId) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const db = await getDb();
        const collection = db.collection(COLLECTION_NAME);

        // Update or insert active viewer
        await collection.updateOne(
            { tabId, userId },
            {
                $set: {
                    tabId,
                    userId,
                    userName: userName || userId,
                    userEmail: userEmail || "",
                    lastSeen: new Date(),
                },
            },
            { upsert: true }
        );

        // Clean up inactive viewers
        await cleanupInactiveViewers();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error tracking active viewer:", error);
        return NextResponse.json(
            { error: "Failed to track active viewer" },
            { status: 500 }
        );
    }
}

// Get active viewers for a tab
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const tabId = searchParams.get("tabId");

        if (!tabId) {
            return NextResponse.json(
                { error: "Missing tabId parameter" },
                { status: 400 }
            );
        }

        const db = await getDb();
        const collection = db.collection(COLLECTION_NAME);

        // Clean up inactive viewers first
        await cleanupInactiveViewers();

        // Get active viewers for this tab
        const viewers = await collection
            .find({ tabId })
            .sort({ lastSeen: -1 })
            .toArray();

        const activeViewers = viewers.map((v) => ({
            userId: v.userId,
            userName: v.userName || v.userId,
            userEmail: v.userEmail || "",
            lastSeen: v.lastSeen,
        }));

        return NextResponse.json({ viewers: activeViewers });
    } catch (error) {
        console.error("Error getting active viewers:", error);
        return NextResponse.json(
            { error: "Failed to get active viewers" },
            { status: 500 }
        );
    }
}

