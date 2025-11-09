import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

export async function GET() {
  const result = await pingDb();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
