"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const displayEmail = email ?? t("auth.yourEmail");

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("auth.checkEmailTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.sentLoginLinkTo")} <strong className="text-foreground">{displayEmail}</strong>.
        </p>
        <Button asChild className="w-full">
          <Link href="/">{t("auth.backToHome")}</Link>
        </Button>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<main className="min-h-screen flex items-center justify-center p-4"><p className="text-muted-foreground">{t("common.loading")}</p></main>}>
      <VerifyEmailContent />
    </React.Suspense>
  );
}
