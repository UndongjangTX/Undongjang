"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

function getUpdatePasswordSchema() {
  const passwordSchema = z
    .string()
    .min(8, t("auth.passwordMin"))
    .refine((v) => /[A-Z]/.test(v), t("auth.passwordUppercase"))
    .refine((v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v), t("auth.passwordSpecial"));
  return z
    .object({
      password: passwordSchema,
      confirmPassword: z.string().min(1, t("auth.confirmYourPassword")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });
}

type UpdatePasswordForm = z.infer<ReturnType<typeof getUpdatePasswordSchema>>;

export default function UpdatePasswordPage() {
  const [ready, setReady] = React.useState(false);
  const [linkInvalid, setLinkInvalid] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>({
    resolver: zodResolver(getUpdatePasswordSchema()),
    defaultValues: { password: "", confirmPassword: "" },
  });

  React.useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const timer = setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setReady(true);
      if (!session?.user) setLinkInvalid(true);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  async function onSubmit(data: UpdatePasswordForm) {
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setSuccess(true);
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("auth.confirmingLink")}</p>
      </main>
    );
  }

  if (linkInvalid) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-muted-foreground">
            {t("auth.linkInvalidOrExpired")}
          </p>
          <Button asChild>
            <Link href="/profile">{t("auth.goToProfile")}</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-primary-green font-medium">
            {t("auth.passwordUpdatedSuccess")}
          </p>
          <Button asChild>
            <Link href="/profile">{t("auth.goToProfile")}</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-primary-green">
            {t("auth.setNewPassword")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.enterNewPasswordBelow")}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.newPassword")}</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("auth.confirmNewPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          {submitError && (
            <p className="text-xs text-destructive">{submitError}</p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("auth.updating") : t("auth.updatePasswordButton")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/profile" className="font-medium text-point-coral hover:underline">
            {t("groups.backToProfile")}
          </Link>
        </p>
      </div>
    </main>
  );
}
