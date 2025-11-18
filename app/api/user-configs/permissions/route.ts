import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { UserPermission, UserRole } from "@/types/permission";
import { isSuperAdminFromEnv, canUserManagePermissions } from "@/lib/permissions";

const COLLECTION_NAME = "user_permissions";

// Helper to get user email from request
async function getUserEmail(request: NextRequest): Promise<string | null> {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.userEmail || request.headers.get("x-user-email");
    return email || null;
  } catch {
    return request.headers.get("x-user-email");
  }
}

// GET /api/user-configs/permissions - Get all permissions (super admin only)
export async function GET(request: NextRequest) {
  try {
    const userEmail = request.headers.get("x-user-email");
    
    if (!userEmail) {
      return NextResponse.json(
        { error: "User email required" },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (!isSuperAdminFromEnv(userEmail)) {
      // Check permission from database
      const db = await getDb();
      const collection = db.collection(COLLECTION_NAME);
      const userPermission = await collection.findOne({ email: userEmail });
      
      if (!canUserManagePermissions(userEmail, userPermission?.role)) {
        return NextResponse.json(
          { error: "Unauthorized: Super admin access required" },
          { status: 403 }
        );
      }
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);
    const permissions = await collection.find({}).toArray();

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

// POST /api/user-configs/permissions - Create or update permission (super admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role, userEmail: requesterEmail } = body as {
      email: string;
      role: UserRole;
      userEmail?: string;
    };

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    const requester = requesterEmail || request.headers.get("x-user-email");
    
    if (!requester) {
      return NextResponse.json(
        { error: "Requester email required" },
        { status: 401 }
      );
    }

    // Check if requester is super admin
    if (!isSuperAdminFromEnv(requester)) {
      // Check permission from database
      const db = await getDb();
      const collection = db.collection(COLLECTION_NAME);
      const requesterPermission = await collection.findOne({ email: requester });
      
      if (!canUserManagePermissions(requester, requesterPermission?.role)) {
        return NextResponse.json(
          { error: "Unauthorized: Super admin access required" },
          { status: 403 }
        );
      }
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Check if permission already exists
    const existing = await collection.findOne({ email });
    
    const permission: UserPermission = {
      email: email.toLowerCase(),
      role,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: existing?.createdBy || requester,
    };

    await collection.updateOne(
      { email: email.toLowerCase() },
      { $set: permission },
      { upsert: true }
    );

    return NextResponse.json({ success: true, permission });
  } catch (error) {
    console.error("Error saving permission:", error);
    return NextResponse.json(
      { error: "Failed to save permission" },
      { status: 500 }
    );
  }
}

// DELETE /api/user-configs/permissions - Delete permission (super admin only)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userEmail: requesterEmail } = body as {
      email: string;
      userEmail?: string;
    };

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const requester = requesterEmail || request.headers.get("x-user-email");
    
    if (!requester) {
      return NextResponse.json(
        { error: "Requester email required" },
        { status: 401 }
      );
    }

    // Check if requester is super admin
    if (!isSuperAdminFromEnv(requester)) {
      // Check permission from database
      const db = await getDb();
      const collection = db.collection(COLLECTION_NAME);
      const requesterPermission = await collection.findOne({ email: requester });
      
      if (!canUserManagePermissions(requester, requesterPermission?.role)) {
        return NextResponse.json(
          { error: "Unauthorized: Super admin access required" },
          { status: 403 }
        );
      }
    }

    // Prevent deleting super admin from env
    if (isSuperAdminFromEnv(email)) {
      return NextResponse.json(
        { error: "Cannot delete super admin from environment variable" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);
    await collection.deleteOne({ email: email.toLowerCase() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting permission:", error);
    return NextResponse.json(
      { error: "Failed to delete permission" },
      { status: 500 }
    );
  }
}

