"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

function getSignupSchema() {
  const passwordSchema = z
    .string()
    .min(8, t("auth.passwordMin"))
    .refine((v) => /[A-Z]/.test(v), t("auth.passwordUppercase"))
    .refine((v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v), t("auth.passwordSpecial"));
  return z
    .object({
      firstName: z.string().min(1, t("auth.firstNameRequired")),
      lastName: z.string().min(1, t("auth.lastNameRequired")),
      email: z.string().email(t("auth.validEmail")),
      password: passwordSchema,
      confirmPassword: z.string().min(1, t("auth.confirmYourPassword")),
      phone: z.string().optional(),
      code: z.string().optional(),
      termsAccepted: z.boolean().refine((v) => v === true, {
        message: t("auth.termsRequired"),
      }),
      marketingOptIn: z.boolean().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });
}

type SignupForm = z.infer<ReturnType<typeof getSignupSchema>>;

export default function SignupPage() {
  const router = useRouter();
  const [showCodeInput, setShowCodeInput] = React.useState(false);
  const [phoneVerified, setPhoneVerified] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [oauthError, setOauthError] = React.useState<string | null>(null);

  async function signInWithOAuth(provider: "google" | "kakao") {
    setOauthError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/profile` : undefined,
      },
    });
    if (error) {
      setOauthError(error.message);
      return;
    }
    if (data?.url) window.location.href = data.url;
  }

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace("/profile");
    });
  }, [router]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(getSignupSchema()),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      code: "",
      termsAccepted: false,
      marketingOptIn: false,
    },
  });

  const code = watch("code");
  const phone = watch("phone");
  const termsAccepted = watch("termsAccepted");
  const marketingOptIn = watch("marketingOptIn");

  React.useEffect(() => {
    if (code && code.length === 6) {
      setPhoneVerified(true);
      setVerifyError(null);
    }
  }, [code]);

  function handleVerify() {
    setVerifyError(null);
    const p = phone?.trim();
    if (!p) {
      setVerifyError(t("auth.enterPhoneFirst"));
      return;
    }
    setShowCodeInput(true);
  }

  async function onSubmit(data: SignupForm) {
    const hasPhone = !!data.phone?.trim();
    if (hasPhone && !phoneVerified) {
      setVerifyError(t("auth.verifyPhoneWithCode"));
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: `${data.firstName} ${data.lastName}`.trim(),
          first_name: data.firstName,
          last_name: data.lastName,
          ...(data.phone?.trim() && { phone_number: data.phone.trim() }),
          terms_accepted: data.termsAccepted,
          marketing_opt_in: data.marketingOptIn ?? false,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setVerifyError(error.message);
      return;
    }

    router.push(
      `/signup/verify-email?email=${encodeURIComponent(data.email)}`
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-primary-green">{t("auth.signupTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.signupSub")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signInWithOAuth("google")}
          >
            {t("auth.signUpWithGoogle")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signInWithOAuth("kakao")}
          >
            {t("auth.signUpWithKakao")}
          </Button>
        </div>
        {oauthError && (
          <p className="text-xs text-destructive">{oauthError}</p>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t("auth.orSignUpWithEmail")}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("auth.firstName")}</Label>
              <Input
                id="firstName"
                placeholder={t("auth.firstNamePlaceholder")}
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("auth.lastName")}</Label>
              <Input
                id="lastName"
                placeholder={t("auth.lastNamePlaceholder")}
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
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
            <Label htmlFor="confirmPassword">{t("auth.confirmPasswordLabel")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t("auth.phoneOptional")}</Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                type="tel"
                placeholder={t("auth.phonePlaceholder")}
                {...register("phone")}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleVerify}
                disabled={!phone?.trim()}
              >
                {t("auth.verify")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("auth.phoneRequiredLater")}
            </p>
            {showCodeInput && (
              <div className="flex gap-2 items-center mt-2">
                <Input
                  placeholder={t("auth.codePlaceholder")}
                  maxLength={6}
                  className="w-28 font-mono"
                  {...register("code")}
                />
                {phoneVerified && (
                  <span className="flex items-center gap-1 text-sm text-primary-green">
                    <Check className="h-4 w-4" /> {t("auth.verified")}
                  </span>
                )}
              </div>
            )}
            {verifyError && (
              <p className="text-xs text-destructive">{verifyError}</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) =>
                  setValue("termsAccepted", checked === true)
                }
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
                {t("auth.termsRequired")}
              </Label>
            </div>
            {errors.termsAccepted && (
              <p className="text-xs text-destructive">
                {errors.termsAccepted.message}
              </p>
            )}
            <div className="flex items-start gap-2">
              <Checkbox
                id="marketing"
                checked={marketingOptIn}
                onCheckedChange={(checked) =>
                  setValue("marketingOptIn", checked === true)
                }
              />
              <Label htmlFor="marketing" className="text-sm font-normal leading-relaxed cursor-pointer">
                {t("auth.marketingOptional")}
              </Label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              (!!phone?.trim() && !phoneVerified)
            }
          >
            {isSubmitting ? t("auth.creatingAccount") : t("auth.signUp")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-point-coral hover:underline"
          >
            {t("nav.logIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
