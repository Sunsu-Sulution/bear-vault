// Helper function to record changes
export async function recordChange({
  tabId,
  userId,
  userName,
  userEmail,
  action,
  entityType,
  entityId,
  entityName,
  changes,
}: {
  tabId: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: "create" | "update" | "delete" | "rename";
  entityType: "chart" | "tab";
  entityId: string;
  entityName: string;
  changes?: { field: string; oldValue: unknown; newValue: unknown }[];
}) {
  try {
    await fetch("/api/user-configs/change-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tabId,
        userId,
        userName,
        userEmail,
        action,
        entityType,
        entityId,
        entityName,
        changes,
      }),
    });
  } catch (error) {
    console.error("Error recording change:", error);
  }
}

