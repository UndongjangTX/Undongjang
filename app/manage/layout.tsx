"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { isSiteAdmin } from "@/lib/site-admin";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = React.useState<"loading" | "allowed" | "forbidden">("loading");

  React.useEffect(() => {
    getCurrentUserProfile().then(async (profile) => {
      if (!profile?.id) {
        router.replace("/login?redirect=" + encodeURIComponent(pathname || "/manage"));
        return;
      }
      const allowed = await isSiteAdmin(profile.id);
      setStatus(allowed ? "allowed" : "forbidden");
    });
  }, [pathname, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("siteAdmin.loading")}</p>
      </main>
    );
  }

  if (status === "forbidden") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">{t("misc.noAccess")}</p>
        <Button asChild variant="outline">
          <Link href="/">{t("misc.backToHome")}</Link>
        </Button>
      </main>
    );
  }

  return <>{children}</>;
}
