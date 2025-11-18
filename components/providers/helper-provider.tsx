"use client";

import { BackendClient } from "@/lib/request";
import { useRouter, usePathname } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { useAlertContext } from "./alert-provider";
import { useFullLoadingContext } from "./full-loading-provider";
import { getItem } from "@/lib/storage";
import { GetUserInfoResponse } from "@/types/lask";
import { UserRole, PermissionCheckResult } from "@/types/permission";

interface HeaderContextType {
  title: string;
  setTitle: (title: string) => void;
}

interface HelperContextType {
  setAlert: ReturnType<typeof useAlertContext>;
  setFullLoading: (value: boolean, useDino?: boolean) => boolean;
  backendClient: BackendClient;
  router: ReturnType<typeof useRouter>;
  userInfo: GetUserInfoResponse | undefined;
  setUserInfo: Dispatch<SetStateAction<GetUserInfoResponse | undefined>>;
  header: HeaderContextType;
  isLocked: boolean;
  setIsLocked: Dispatch<SetStateAction<boolean>>;
  notesVisible: boolean;
  setNotesVisible: Dispatch<SetStateAction<boolean>>;
  userRole: UserRole | null;
  permissions: PermissionCheckResult | null;
  refreshPermissions: () => Promise<void>;
}

const HelperContext = createContext<() => HelperContextType>(() => {
  return {
    setAlert: (
      title: string,
      text: string,
      action: undefined | (() => void),
      canCancel: boolean,
    ) => [title, text, action, canCancel],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setFullLoading: (value: boolean, useDino: boolean = false) => value,
    backendClient: new BackendClient(
      (
        message: string,
        type: string,
        action: (() => void) | undefined,
        isOpen: boolean,
      ) => {
        void message;
        void type;
        void action;
        void isOpen;
      },
    ),
    router: {} as ReturnType<typeof useRouter>,
    userInfo: undefined,
    setUserInfo: (() => undefined) as Dispatch<
      SetStateAction<GetUserInfoResponse | undefined>
    >,
    header: {
      title: "",
      setTitle: () => {},
    },
    isLocked: true,
    setIsLocked: () => {},
    notesVisible: true,
    setNotesVisible: () => {},
    userRole: null,
    permissions: null,
    refreshPermissions: async () => {},
  };
});

export function HelperProvider({ children }: { children: ReactNode }) {
  const setAlert = useAlertContext();
  const setFullLoading = useFullLoadingContext();
  const router = useRouter();
  const pathname = usePathname();
  const [title, setTitle] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(true); // Default to locked mode
  const [notesVisible, setNotesVisible] = useState<boolean>(() => {
    // Load from localStorage if available
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("notes_visible");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  const [userInfo, setUserInfo] = useState<GetUserInfoResponse | undefined>(
    () => {
      try {
        const storedUserInfo = getItem("user_info");
        if (storedUserInfo) {
          return JSON.parse(storedUserInfo);
        }
      } catch (e) {
        console.log(e);
        localStorage.removeItem("user_info");
      }
      return undefined;
    },
  );

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionCheckResult | null>(null);

  // Fetch user permissions
  const refreshPermissions = useCallback(async () => {
    if (!userInfo?.email) {
      setUserRole(null);
      setPermissions(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/user-configs/user-permission?email=${encodeURIComponent(userInfo.email)}`
      );
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role);
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      // On error, assume no permission (safer approach)
      setUserRole(null);
      setPermissions({
        canView: false,
        canEdit: false,
        canManagePermissions: false,
        isSuperAdmin: false,
      });
    }
  }, [userInfo?.email]);

  // Fetch permissions when user info changes
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    // Don't redirect if user is viewing a public page
    if (!userInfo && !pathname?.startsWith("/public")) {
      router.push("/");
    }
  }, [userInfo, router, pathname]);

  // Save notesVisible to localStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("notes_visible", String(notesVisible));
    }
  }, [notesVisible]);

  const useHelper = useCallback(
    () => ({
      setAlert,
      setFullLoading,
      backendClient: new BackendClient(setAlert),
      router,
      userInfo,
      setUserInfo,
      header: {
        title,
        setTitle,
      },
      isLocked,
      setIsLocked,
      notesVisible,
      setNotesVisible,
      userRole,
      permissions,
      refreshPermissions,
    }),
    [setAlert, setFullLoading, router, userInfo, title, isLocked, notesVisible, userRole, permissions, refreshPermissions],
  );

  return (
    <HelperContext.Provider value={useHelper}>
      {children}
    </HelperContext.Provider>
  );
}

export const useHelperContext = () => useContext(HelperContext);
