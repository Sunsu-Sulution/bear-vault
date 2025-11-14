/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { useEffect } from "react";
import { useHelperContext } from "@/components/providers/helper-provider";

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userInfo, router } = useHelperContext()();

  useEffect(() => {
    if (userInfo?.email == "") {
      router.push("/");
    }
  }, [userInfo]);

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
