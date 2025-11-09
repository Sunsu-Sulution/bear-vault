import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ChartType } from "@/types/chart";

const COLLECTION_NAME = "chat_messages";

export interface ChatMessage {
  _id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  timestamp: Date;
  tabId?: string; // Optional: scope messages to a specific tab
  sqlQuery?: string; // Optional SQL query used for AI responses
  sqlColumns?: string[];
  connectionId?: string;
  database?: string;
  tabSuggestion?: string;
  originalQuestion?: string;
  suggestedCharts?: Array<{
    type: ChartType;
    title?: string;
    xAxisKey?: string;
    yAxisKey?: string;
    seriesKey?: string;
    groupByKey?: string;
    aggregate?: "sum" | "count" | "avg";
  }>;
  chartSummaries?: string[];
}

// GET /api/chat - Fetch messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get("tabId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const lastMessageId = searchParams.get("lastMessageId");

    const db = await getDb();
    const collection = db.collection<ChatMessage>(COLLECTION_NAME);

    // Build query
    const query: Record<string, unknown> = {};
    if (tabId) {
      query.tabId = tabId;
    }
    if (lastMessageId) {
      try {
        query._id = { $gt: new ObjectId(lastMessageId) };
      } catch {
        // Invalid ObjectId, ignore
      }
    }

    // Fetch messages, sorted by timestamp (ascending - oldest first)
    const messages = await collection
      .find(query)
      .sort({ timestamp: 1 })
      .limit(limit)
      .toArray();

    const formattedMessages = messages.map((msg) => ({
      _id: msg._id.toString(),
      userId: msg.userId,
      userName: msg.userName,
      userEmail: msg.userEmail,
      message: msg.message,
      timestamp: msg.timestamp.toISOString(),
      tabId: msg.tabId,
      sqlQuery: msg.sqlQuery,
      sqlColumns: msg.sqlColumns,
      connectionId: msg.connectionId,
      database: msg.database,
      tabSuggestion: msg.tabSuggestion,
      originalQuestion: msg.originalQuestion,
      suggestedCharts: msg.suggestedCharts,
      chartSummaries: msg.chartSummaries,
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
}

// POST /api/chat - Send a message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      userName,
      userEmail,
      message,
      tabId,
      sqlQuery,
      sqlColumns,
      connectionId,
      database,
      tabSuggestion,
      originalQuestion,
      suggestedCharts,
      chartSummaries,
    }: {
      userId: string;
      userName: string;
      userEmail: string;
      message: string;
      tabId?: string;
      sqlQuery?: string;
      sqlColumns?: string[];
      connectionId?: string;
      database?: string;
      tabSuggestion?: string;
      originalQuestion?: string;
      suggestedCharts?: Array<{
        type: ChartType;
        title?: string;
        xAxisKey?: string;
        yAxisKey?: string;
        seriesKey?: string;
        groupByKey?: string;
        aggregate?: "sum" | "count" | "avg";
      }>;
      chartSummaries?: string[];
    } = body;

    if (!userId || !userName || !message || !message.trim()) {
      return NextResponse.json(
        { error: "userId, userName, and message are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection<ChatMessage>(COLLECTION_NAME);

    const chatMessage: Omit<ChatMessage, "_id"> = {
      userId,
      userName,
      userEmail: userEmail || "",
      message: message.trim(),
      timestamp: new Date(),
      tabId,
      sqlQuery,
      sqlColumns,
      connectionId,
      database,
      tabSuggestion,
      originalQuestion,
      suggestedCharts,
      chartSummaries,
    };

    const result = await collection.insertOne(chatMessage);

    const savedMessage = {
      _id: result.insertedId.toString(),
      ...chatMessage,
      timestamp: chatMessage.timestamp.toISOString(),
    };

    return NextResponse.json({ message: savedMessage }, { status: 201 });
  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Failed to send chat message" },
      { status: 500 }
    );
  }
}

