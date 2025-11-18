/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardTabs } from "@/hooks/use-dashboard-tabs";
import { useHelperContext } from "@/components/providers/helper-provider";

export default function Page() {
  const router = useRouter();
  const { tabs, isLoaded } = useDashboardTabs();
  const { setFullLoading, permissions } = useHelperContext()();

  useEffect(() => {
    // Check permissions first
    if (permissions !== null && !permissions.canView) {
      router.push("/dashboard/no-permission");
      return;
    }

    // Wait for permissions to load
    if (permissions === null) {
      setFullLoading(true);
      return;
    }

    setFullLoading(true);
    if (!isLoaded) return;

    if (tabs && tabs.length > 0) {
      setFullLoading(false);
      router.push(`/dashboard/${tabs[0].id}`);
    } else {
      setFullLoading(false);
      router.push("/dashboard/db-connection");
    }
  }, [tabs, isLoaded, router, permissions, setFullLoading]);

  // Don't render if no permission
  if (permissions !== null && !permissions.canView) {
    return null;
  }

  return <div></div>;
}
