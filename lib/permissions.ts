import { UserRole, PermissionCheckResult } from "@/types/permission";
import { GetUserInfoResponse } from "@/types/lask";

/**
 * Get super admin email from environment variable
 */
export function getSuperAdminEmail(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPER_ADMIN;
}

/**
 * Check if user is super admin (from env variable)
 */
export function isSuperAdminFromEnv(userEmail?: string): boolean {
  if (!userEmail) return false;
  const superAdminEmail = getSuperAdminEmail();
  return superAdminEmail?.toLowerCase() === userEmail.toLowerCase();
}

/**
 * Get user role from permission or determine from email
 */
export function getUserRole(
  userEmail?: string,
  permissionRole?: UserRole,
): UserRole {
  // Check if user is super admin from env
  if (isSuperAdminFromEnv(userEmail)) {
    return "super_admin";
  }
  
  // Return permission role or default to viewer
  return permissionRole || "viewer";
}

/**
 * Check permissions for a user
 */
export function checkPermissions(
  userEmail?: string,
  permissionRole?: UserRole,
  hasPermission?: boolean, // Whether user has a permission record in database
): PermissionCheckResult {
  // If user is super admin from env, they always have access
  if (isSuperAdminFromEnv(userEmail)) {
    return {
      canView: true,
      canEdit: true,
      canManagePermissions: true,
      isSuperAdmin: true,
    };
  }

  // If user doesn't have permission in database, they can't view
  if (hasPermission === false) {
    return {
      canView: false,
      canEdit: false,
      canManagePermissions: false,
      isSuperAdmin: false,
    };
  }

  const role = getUserRole(userEmail, permissionRole);
  
  return {
    canView: true, // All roles with permission can view
    canEdit: role === "editor" || role === "super_admin",
    canManagePermissions: role === "super_admin",
    isSuperAdmin: role === "super_admin",
  };
}

/**
 * Check if user can perform an action
 */
export function canUserEdit(userEmail?: string, permissionRole?: UserRole): boolean {
  return checkPermissions(userEmail, permissionRole).canEdit;
}

export function canUserManagePermissions(
  userEmail?: string,
  permissionRole?: UserRole,
): boolean {
  return checkPermissions(userEmail, permissionRole).canManagePermissions;
}

