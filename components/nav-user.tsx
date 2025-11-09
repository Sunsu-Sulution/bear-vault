"use client";

import { IconDotsVertical, IconLogout } from "@tabler/icons-react";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useHelperContext } from "./providers/helper-provider";
import { isErrorResponse } from "@/types/lask";
import { useEffect } from "react";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { userInfo, backendClient, setAlert, setFullLoading } =
    useHelperContext()();

  useEffect(() => {}, [userInfo?.open_id]);

  const onLogout = async () => {
    setAlert(
      "คุณต้องการที่จะออกจากระบบใช่หรือไม่?",
      "กด ตกลง เพื่อดำเนินการต่อ",
      async () => {
        setFullLoading(true);
        const response = await backendClient.logout();
        if (isErrorResponse(response)) {
          return;
        }
        window.location.reload();
      },
      true,
    );
  };

  return (
    <SidebarMenu className="cursor-pointer">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage
                  src={userInfo?.avatar_middle}
                  alt={userInfo?.name}
                />
              </Avatar>
              {userInfo?.name && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span
                    suppressHydrationWarning
                    className="truncate font-medium"
                  >
                    {userInfo?.name}
                  </span>
                  <span
                    suppressHydrationWarning
                    className="text-muted-foreground truncate text-xs"
                  >
                    {userInfo?.email}
                  </span>
                </div>
              )}
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={userInfo?.avatar_middle}
                    alt={userInfo?.name}
                  />
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {userInfo?.name || ""}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {userInfo?.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
