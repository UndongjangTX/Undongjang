"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { t } from "@/lib/i18n";

export default function BootstrapAdminPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "fail" | "logged-out">("idle");
  const [message, setMessage] = React.useState<string>("");

  async function handleBootstrap() {
    setStatus("loading");
    setMessage("");
    const profile = await getCurrentUserProfile();
    if (!profile?.id) {
      setStatus("logged-out");
      setMessage(t("bootstrapAdmin.pleaseLogin"));
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc("bootstrap_site_admin", {});
    if (error) {
      setStatus("fail");
      setMessage(error.message);
      return;
    }
    if (data === true) {
      setStatus("done");
      setMessage(t("bootstrapAdmin.youAreNowAdmin"));
      setTimeout(() => router.push("/manage"), 2000);
    } else {
      setStatus("fail");
      setMessage(t("bootstrapAdmin.alreadyHasAdmin"));
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full rounded-lg border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">{t("bootstrapAdmin.title")}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {t("bootstrapAdmin.description")}
        </p>
        {status === "logged-out" && (
          <p className="text-sm text-destructive mb-4">{message}</p>
        )}
        {status === "fail" && (
          <p className="text-sm text-destructive mb-4">{message}</p>
        )}
        {status === "done" && (
          <p className="text-sm text-primary-green mb-4">{message}</p>
        )}
        {status !== "done" && (
          <Button
            variant="green"
            onClick={handleBootstrap}
            disabled={status === "loading"}
          >
            {status === "loading" ? t("bootstrapAdmin.checking") : t("bootstrapAdmin.bootstrap")}
          </Button>
        )}
        <div className="mt-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">{t("bootstrapAdmin.backToHome")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
