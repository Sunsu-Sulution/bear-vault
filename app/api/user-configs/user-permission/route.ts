import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { UserPermission, UserRole } from "@/types/permission";
import { checkPermissions, isSuperAdminFromEnv } from "@/lib/permissions";

const COLLECTION_NAME = "user_permissions";

// GET /api/user-configs/user-permission - Get current user's permission
export async function GET(request: NextRequest) {
  try {
    const userEmail = request.headers.get("x-user-email") || 
                     request.nextUrl.searchParams.get("email");

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email required" },
        { status: 400 }
      );
    }

    // Check if user is super admin from env
    if (isSuperAdminFromEnv(userEmail)) {
      return NextResponse.json({
        role: "super_admin" as UserRole,
        permissions: checkPermissions(userEmail, "super_admin", true),
      });
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);
    const permission = await collection.findOne({ 
      email: userEmail.toLowerCase() 
    }) as UserPermission | null;

    // If no permission found, user has no access
    if (!permission) {
      return NextResponse.json({
        role: null,
        permissions: checkPermissions(userEmail, undefined, false),
      });
    }

    const role = permission.role;
    const permissions = checkPermissions(userEmail, role, true);

    return NextResponse.json({
      role,
      permissions,
    });
  } catch (error) {
    console.error("Error fetching user permission:", error);
    return NextResponse.json(
      { error: "Failed to fetch user permission" },
      { status: 500 }
    );
  }
}

