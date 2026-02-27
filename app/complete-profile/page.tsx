"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function CompleteProfilePage() {
  return (
    <main className="min-h-screen">
      <section className="container px-4 py-10 md:py-14">
        <div className="max-w-xl space-y-4">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl text-primary-green">
            {t("completeProfilePage.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("completeProfilePage.description")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/profile">{t("completeProfilePage.goToProfile")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">{t("completeProfilePage.backToHome")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

