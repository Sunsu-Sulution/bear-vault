/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { useHelperContext } from "@/components/providers/helper-provider";
import { Card } from "@/components/ui/card";
import { AlertCircle, Mail } from "lucide-react";

export default function NoPermissionPage() {
  const { userInfo, setFullLoading } = useHelperContext()();
  const [adminEmail, setAdminEmail] = useState<string>("");

  useEffect(() => {
    // Get admin email from environment variable (client-side accessible)
    // Since NEXT_PUBLIC_SUPER_ADMIN is available on client side
    const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN || "";
    setFullLoading(false);
    setAdminEmail(superAdminEmail);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))] p-5">
      <Card className="max-w-md w-full p-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">คุณไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-muted-foreground">
              คุณยังไม่มีสิทธิ์ในการเข้าถึงระบบนี้
            </p>
          </div>

          {adminEmail && (
            <div className="w-full pt-4 border-t space-y-3">
              <p className="text-sm text-muted-foreground">
                กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าถึง:
              </p>
              <div className="flex items-center justify-center gap-2 p-3 bg-muted rounded-lg">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${adminEmail}`}
                  className="text-primary hover:underline font-medium"
                >
                  {adminEmail}
                </a>
              </div>
            </div>
          )}

          {userInfo?.email && (
            <div className="w-full pt-2">
              <p className="text-xs text-muted-foreground">
                อีเมลของคุณ: {userInfo.email}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
