export type UserRole = "viewer" | "editor" | "super_admin";

export interface UserPermission {
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Email of the user who created this permission
}

export interface PermissionCheckResult {
  canView: boolean;
  canEdit: boolean;
  canManagePermissions: boolean;
  isSuperAdmin: boolean;
}

