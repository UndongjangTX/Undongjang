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
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, uploadProfilePhoto, validateAvatarFile, type UserProfile } from "@/lib/user-profile";
import { getCategoryDisplayName } from "@/lib/category-labels";
import { t } from "@/lib/i18n";

type Category = { id: string; name: string; slug: string };

const profileSchema = z.object({
  phone_number: z.string().optional(),
  code: z.string().optional(),
  city_location: z.string().optional(),
  marketing_opt_in: z.boolean().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [authEmail, setAuthEmail] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [passwordEmailSent, setPasswordEmailSent] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = React.useState(false);
  const [phoneVerified, setPhoneVerified] = React.useState(false);
  const [phoneVerifyError, setPhoneVerifyError] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [isYongbyung, setIsYongbyung] = React.useState(false);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone_number: "",
      code: "",
      city_location: "",
      marketing_opt_in: false,
    },
  });

  const phoneNumber = watch("phone_number");
  const code = watch("code");
  const marketingOptIn = watch("marketing_opt_in");

  React.useEffect(() => {
    if (code && code.length === 6) {
      setPhoneVerified(true);
      setPhoneVerifyError(null);
    }
  }, [code]);

  React.useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      setAuthEmail(session.user.email ?? null);
      const [p, { data: categoriesData }] = await Promise.all([
        getCurrentUserProfile(),
        supabase.from("categories").select("id, name, slug, emoji").order("name"),
      ]);
      if (!p) {
        setLoading(false);
        return;
      }
      setProfile(p);
      setCategories(categoriesData ?? []);
      setSelectedCategoryIds(p.interested_categories ?? []);
      setIsYongbyung(p.is_yongbyung ?? false);
      const initialPhone = p.phone_number ?? "";
      setValue("phone_number", initialPhone);
      setValue("code", "");
      setValue("city_location", p.city_location ?? "");
      setValue("marketing_opt_in", p.marketing_opt_in ?? false);
      setPhoneVerified(!!initialPhone.trim());
      setShowCodeInput(false);
      setLoading(false);
    })();
  }, [router, setValue]);

  function handleVerify() {
    setPhoneVerifyError(null);
    const p = phoneNumber?.trim();
    if (!p) {
      setPhoneVerifyError(t("auth.enterPhoneFirst"));
      return;
    }
    setShowCodeInput(true);
  }

  const initialPhoneFromProfile = profile?.phone_number?.trim() ?? "";
  React.useEffect(() => {
    if (!profile) return;
    const current = phoneNumber?.trim() ?? "";
    if (current !== initialPhoneFromProfile) setPhoneVerified(false);
  }, [phoneNumber, initialPhoneFromProfile, profile]);

  async function onProfileSubmit(data: ProfileForm) {
    setProfileError(null);
    setProfileSuccess(null);
    setPhoneVerifyError(null);
    const hasPhone = !!data.phone_number?.trim();
    if (hasPhone && !phoneVerified) {
      setProfileError(t("auth.verifyPhoneWithCode"));
      return;
    }
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setProfileError(t("profile.notSignedIn"));
      return;
    }
    const { error } = await supabase
      .from("users")
      .update({
        phone_number: data.phone_number?.trim() || null,
        city_location: data.city_location?.trim() || null,
        marketing_opt_in: data.marketing_opt_in ?? false,
        interested_categories: selectedCategoryIds,
        is_yongbyung: isYongbyung,
      })
      .eq("id", session.user.id);

    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfileSuccess(t("profile.profileUpdated"));
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            phone_number: data.phone_number?.trim() || null,
            city_location: data.city_location?.trim() || null,
            marketing_opt_in: data.marketing_opt_in ?? false,
            interested_categories: selectedCategoryIds,
            is_yongbyung: isYongbyung,
          }
        : null
    );
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSendPasswordReset() {
    setPasswordError(null);
    setPasswordEmailSent(false);
    if (!authEmail) {
      setPasswordError(t("profile.noEmailOnAccount"));
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPasswordEmailSent(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("profile.loadingProfile")}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("profile.couldNotLoadProfile")}</p>
        <Button asChild variant="outline" className="ml-3">
          <Link href="/">{t("misc.backToHome")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-primary-green">{t("profile.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("profile.manageAccount")}
          </p>
        </div>

        <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label>{t("profile.profilePhoto")}</Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-muted bg-muted">
                <Image
                  src={profile.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop"}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !profile?.id) return;
                    const validation = validateAvatarFile(file);
                    if (validation) {
                      setPhotoError(validation);
                      return;
                    }
                    setPhotoError(null);
                    setPhotoUploading(true);
                    const url = await uploadProfilePhoto(profile.id, file);
                    setPhotoUploading(false);
                    if (url) {
                      setProfile((prev) => (prev ? { ...prev, avatar_url: url } : null));
                    } else {
                      setPhotoError(t("profile.uploadFailed"));
                    }
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={photoUploading}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoUploading ? t("profile.uploadingPhoto") : t("profile.changePhoto")}
                </Button>
                {photoError && (
                  <p className="text-xs text-destructive mt-1">{photoError}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("profile.photoFormatHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("auth.email")}</Label>
            <Input
              type="email"
              value={authEmail ?? ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {t("profile.emailCannotChange")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("auth.fullName")}</Label>
            <Input
              value={profile.full_name ?? ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {t("profile.nameCannotChange")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">{t("auth.phoneOptional")}</Label>
            <div className="flex gap-2">
              <Input
                id="phone_number"
                type="tel"
                placeholder={t("auth.phonePlaceholder")}
                {...register("phone_number")}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleVerify}
                disabled={!phoneNumber?.trim()}
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
            {phoneVerifyError && (
              <p className="text-xs text-destructive">{phoneVerifyError}</p>
            )}
            {errors.phone_number && (
              <p className="text-xs text-destructive">
                {errors.phone_number.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("profile.interestedCategories")}</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  type="button"
                  variant={selectedCategoryIds.includes(cat.id) ? "green" : "outline"}
                  size="sm"
                  onClick={() => toggleCategory(cat.id)}
                >
                  {getCategoryDisplayName(cat.name, cat.name_ko ?? undefined)}
                </Button>
              ))}
            </div>
            {categories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("profile.selectCategoriesHint")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="yongbyung"
                checked={isYongbyung}
                onCheckedChange={(checked) => setIsYongbyung(checked === true)}
              />
              <Label
                htmlFor="yongbyung"
                className="text-sm font-normal cursor-pointer"
              >
                {t("profile.yongbyungLabel")}
              </Label>
            </div>
            <div className="rounded-lg bg-primary-green/15 px-3 py-2 text-sm text-foreground">
              {t("profile.yongbyungHint")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city_location">{t("profile.locationLabel")}</Label>
            <Input
              id="city_location"
              type="text"
              placeholder={t("profile.locationPlaceholder")}
              {...register("city_location")}
            />
            <p className="text-xs text-muted-foreground">
              {t("profile.locationHint")}
            </p>
            {errors.city_location && (
              <p className="text-xs text-destructive">
                {errors.city_location.message}
              </p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="marketing_opt_in"
              checked={marketingOptIn}
              onCheckedChange={(checked) =>
                setValue("marketing_opt_in", checked === true)
              }
            />
            <Label
              htmlFor="marketing_opt_in"
              className="text-sm font-normal leading-relaxed cursor-pointer"
            >
              {t("profile.marketingEmails")}
            </Label>
          </div>
          {errors.marketing_opt_in && (
            <p className="text-xs text-destructive">
              {errors.marketing_opt_in.message}
            </p>
          )}

          {profileError && (
            <p className="text-xs text-destructive">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="text-xs text-primary-green">{profileSuccess}</p>
          )}
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              (!!phoneNumber?.trim() && !phoneVerified)
            }
          >
            {isSubmitting ? t("profile.savingProfile") : t("profile.saveProfile")}
          </Button>
        </form>

        <section className="space-y-4 border-t pt-6">
          <h2 className="font-heading text-lg font-medium text-primary-green">{t("profile.passwordSection")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("profile.passwordResetHint")}
          </p>
          {passwordEmailSent ? (
            <p className="text-sm text-primary-green">
              {t("profile.checkEmailForLink")}
            </p>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSendPasswordReset}
              >
                {t("profile.sendPasswordResetEmail")}
              </Button>
              {passwordError && (
                <p className="text-xs text-destructive">{passwordError}</p>
              )}
            </>
          )}
        </section>

        <p className="text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-point-coral hover:underline">
            {t("profile.backToHome")}
          </Link>
        </p>
      </div>
    </main>
  );
}
