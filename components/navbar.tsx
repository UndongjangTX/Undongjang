"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Users, Calendar, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useOnboarding } from "@/context/onboarding-context";
import { getCurrentUserProfile, hasPhoneNumber } from "@/lib/user-profile";
import { getUnreadCounts, type UnreadCounts } from "@/lib/messenger";
import { t } from "@/lib/i18n";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Navbar({ className }: { className?: string }) {
  const router = useRouter();
  const { openModal } = useOnboarding();
  const [user, setUser] = React.useState<SupabaseUser | null>(null);
  const [unread, setUnread] = React.useState<UnreadCounts | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  function refreshUnread() {
    if (user?.id) getUnreadCounts(user.id).then(setUnread);
  }

  React.useEffect(() => {
    if (user?.id) refreshUnread();
    else setUnread(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when user id changes only
  }, [user?.id]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="container flex h-14 items-center gap-3 md:gap-6">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-extrabold text-primary-green md:text-xl uppercase tracking-tight"
        >
          {t("brand")}
        </Link>

        {/* Center: Search */}
        <div className="flex-1 flex justify-center min-w-0 max-w-xl mx-4">
          <SearchBar className="w-full" />
        </div>

        {/* Right: Start an Event + Log in / User Menu */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="outline-green"
            size="default"
            className="rounded-full"
            onClick={async () => {
              if (!user) {
                router.push("/login");
                return;
              }
              const profile = await getCurrentUserProfile();
              if (!hasPhoneNumber(profile)) {
                openModal({
                  source: "start_event",
                  onComplete: () => router.push("/events/new"),
                });
                return;
              }
              router.push("/events/new");
            }}
          >
            {t("nav.startEvent")}
          </Button>
          {user ? (
            <DropdownMenu onOpenChange={(open) => open && refreshUnread()}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full text-primary-green hover:bg-primary-green/10 hover:text-primary-green p-0 border-0 shadow-none"
                >
                  <Image src="/icons/Profile.svg" alt="" width={28} height={28} className="h-7 w-7" aria-hidden />
                  <UnreadBadge count={unread?.total ?? 0} />
                  <span className="sr-only">{t("nav.userMenu")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("nav.myAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t("nav.profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/groups-and-events#groups" className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t("nav.myGroups")}
                    </span>
                    {(unread?.groupsUnread ?? 0) > 0 && (
                      <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
                        {(unread?.groupsUnread ?? 0) > 99 ? "99+" : (unread?.groupsUnread ?? 0)}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile/groups-and-events#events" className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {t("nav.myEvents")}
                    </span>
                    {(unread?.eventsUnread ?? 0) > 0 && (
                      <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
                        {(unread?.eventsUnread ?? 0) > 99 ? "99+" : (unread?.eventsUnread ?? 0)}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/messages" className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      {t("nav.messages")}
                    </span>
                    {(unread?.messagesUnread ?? 0) > 0 && (
                      <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground">
                        {(unread?.messagesUnread ?? 0) > 99 ? "99+" : (unread?.messagesUnread ?? 0)}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-muted-foreground cursor-pointer"
                  onSelect={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.logOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline-green" size="default" className="rounded-xl" asChild>
              <Link href="/login">{t("nav.logIn")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
