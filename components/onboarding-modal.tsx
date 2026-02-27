"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile, uploadProfilePhoto, validateAvatarFile, type UserProfile } from "@/lib/user-profile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import { useOnboarding } from "@/context/onboarding-context";
import { getCategoryDisplayName } from "@/lib/category-labels";

type Category = { id: string; name: string; name_ko?: string | null; slug: string };

export function OnboardingModal() {
  const {
    programmaticOpen,
    programmaticSource,
    closeModal: onClose,
  } = useOnboarding();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [isYongbyung, setIsYongbyung] = React.useState(false);
  const [cityLocation, setCityLocation] = React.useState("");

  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [showCodeInput, setShowCodeInput] = React.useState(false);
  const [phoneVerified, setPhoneVerified] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [phoneVerifyError, setPhoneVerifyError] = React.useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = React.useState<File | null>(null);

  const phoneRequired =
    programmaticSource === "start_group" ||
    programmaticSource === "start_event" ||
    programmaticSource === "join_group" ||
    programmaticSource === "join_event";
  const phoneOptional = programmaticSource === "post_signup" || programmaticSource == null;
  const showPhoneField = !profile?.phone_number?.trim();

  React.useEffect(() => {
    if (code.length === 6) {
      setPhoneVerified(true);
      setPhoneVerifyError(null);
    }
  }, [code]);

  React.useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const [p, { data: categoriesData }] = await Promise.all([
        getCurrentUserProfile(),
        supabase.from("categories").select("id, name, name_ko, slug, emoji").order("name"),
      ]);
      setProfile(p);
      setCategories(categoriesData ?? []);
      setLoading(false);
      if (p) {
        setSelectedCategoryIds(p.interested_categories ?? []);
        setIsYongbyung(p.is_yongbyung ?? false);
        setCityLocation(p.city_location ?? "");
      }
    };
    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => subscription.unsubscribe();
  }, []);

  const hasInterestedCategories =
    Array.isArray(profile?.interested_categories) &&
    profile.interested_categories.length > 0;
  const dismissedAutoOnboarding =
    typeof window !== "undefined" &&
    !!window.sessionStorage?.getItem("onboarding_dismissed");
  const autoOpen =
    profile != null &&
    !hasInterestedCategories &&
    !programmaticOpen &&
    !dismissedAutoOnboarding;
  const showModal = (programmaticOpen && programmaticSource != null) || autoOpen;

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function handleVerify() {
    setPhoneVerifyError(null);
    if (!phoneNumber?.trim()) {
      setPhoneVerifyError("Enter a phone number first");
      return;
    }
    setShowCodeInput(true);
  }

  async function saveAndClose(
    payload: {
      city_location?: string | null;
      is_yongbyung: boolean;
      interested_categories: string[];
      phone_number?: string | null;
    },
    wasAutoOpen?: boolean
  ) {
    if (!profile?.id) return false;
    setError(null);
    setSubmitting(true);
    if (profilePhotoFile) {
      const validation = validateAvatarFile(profilePhotoFile);
      if (validation) {
        setError(validation);
        setSubmitting(false);
        return false;
      }
      await uploadProfilePhoto(profile.id, profilePhotoFile);
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update(payload)
      .eq("id", profile.id);

    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return false;
    }
    if (wasAutoOpen && typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem("onboarding_dismissed", "1");
    }
    const updated = await getCurrentUserProfile();
    setProfile(updated);
    onClose();
    return true;
  }

  const wasAutoOpen =
    !programmaticOpen &&
    profile != null &&
    !(
      Array.isArray(profile?.interested_categories) &&
      profile.interested_categories.length > 0
    );

  async function handleComplete() {
    if (!profile?.id) return;
    if (showPhoneField && phoneRequired && !phoneVerified) {
      setError("Please verify your phone with the 6-digit code to continue.");
      return;
    }
    const success = await saveAndClose(
      {
        city_location: cityLocation.trim() || null,
        is_yongbyung: isYongbyung,
        interested_categories: selectedCategoryIds,
        phone_number:
          showPhoneField && phoneNumber.trim()
            ? phoneVerified
              ? phoneNumber.trim()
              : profile?.phone_number ?? null
            : profile?.phone_number ?? null,
      },
      wasAutoOpen
    );
    if (success) setError(null);
  }

  async function handleSkip() {
    if (showPhoneField && phoneRequired && !phoneVerified) {
      setError("Phone number is required to continue. Please add and verify your phone.");
      return;
    }
    if (showPhoneField && phoneNumber.trim() && phoneVerified) {
      await saveAndClose(
        {
          city_location: cityLocation.trim() || null,
          is_yongbyung: isYongbyung,
          interested_categories: selectedCategoryIds,
          phone_number: phoneNumber.trim(),
        },
        wasAutoOpen
      );
    } else {
      await saveAndClose(
        {
          city_location: cityLocation.trim() || null,
          is_yongbyung: isYongbyung,
          interested_categories: selectedCategoryIds,
          phone_number: profile?.phone_number ?? null,
        },
        wasAutoOpen
      );
    }
  }

  if (loading) return null;

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent
        showClose={false}
        closeOnInteractOutside={false}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>
            Welcome to Undongjang! Let&apos;s finish your profile.
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleComplete();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <Label>Interested Categories</Label>
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
                Select all that apply. These match group and event categories.
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
                Register as Yongbyung (Free Agent)
              </Label>
            </div>
            <div className="rounded-lg bg-primary-green/15 px-3 py-2 text-sm text-foreground">
              If you want to try out a group without joining, register as Yongbyung!
            </div>
          </div>

          <div className="space-y-2">
            <Label>Profile photo (optional)</Label>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.gif"
              onChange={(e) => setProfilePhotoFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              JPG, PNG, or GIF. Max 2MB.
            </p>
            {profilePhotoFile && validateAvatarFile(profilePhotoFile) && (
              <p className="text-xs text-destructive">{validateAvatarFile(profilePhotoFile)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-city">Location</Label>
            <Input
              id="onboarding-city"
              type="text"
              placeholder="Enter your city (e.g. Dallas, TX)"
              value={cityLocation}
              onChange={(e) => setCityLocation(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Any city in the US.
            </p>
          </div>

          {showPhoneField && (
            <div className="space-y-2">
              <Label htmlFor="onboarding-phone">
                Phone number {phoneOptional && "(Optional)"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="onboarding-phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVerify}
                  disabled={!phoneNumber?.trim()}
                >
                  Verify
                </Button>
              </div>
              {phoneOptional && (
                <p className="text-xs text-muted-foreground">
                  Phone number required later to join or create a group.
                </p>
              )}
              {showCodeInput && (
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="000000"
                    maxLength={6}
                    className="w-28 font-mono"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  {phoneVerified && (
                    <span className="flex items-center gap-1 text-sm text-primary-green">
                      <Check className="h-4 w-4" /> Verified
                    </span>
                  )}
                </div>
              )}
              {phoneVerifyError && (
                <p className="text-xs text-destructive">{phoneVerifyError}</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="green"
              className="w-full"
              disabled={
                submitting ||
                (showPhoneField && phoneRequired && !phoneVerified)
              }
            >
              {submitting ? "Saving..." : "Complete Profile"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={submitting || (showPhoneField && phoneRequired && !phoneVerified)}
              onClick={handleSkip}
            >
              Skip for Now
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
