/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { useEffect } from "react";
import { useHelperContext } from "@/components/providers/helper-provider";
import { usePathname, useRouter } from "next/navigation";

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userInfo, permissions, setFullLoading } = useHelperContext()();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (userInfo?.email == "") {
      router.push("/");
      return;
    }

    // Handle no-permission page separately
    if (pathname === "/dashboard/no-permission") {
      if (permissions === null) {
        setFullLoading(true);
        return;
      }

      if (permissions.canView) {
        router.push("/dashboard");
        return;
      }

      setFullLoading(false);
      return;
    }

    // Wait for permissions to load
    if (permissions === null) {
      // Still loading permissions, show loading
      setFullLoading(true);
      return;
    }

    // Permissions loaded, check if user has view permission
    if (!permissions.canView) {
      router.push("/dashboard/no-permission");
      return;
    }

    // User has permission, hide loading
    setFullLoading(false);
  }, [userInfo, permissions, router, pathname, setFullLoading]);

  // If current page is no-permission, render children without sidebar
  if (pathname === "/dashboard/no-permission") {
    return <>{children}</>;
  }

  // For other pages, wait for permissions and hide content if not allowed
  if (permissions === null || !permissions.canView) {
    return null;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
