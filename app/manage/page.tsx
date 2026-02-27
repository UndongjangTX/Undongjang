"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listUsersForAdmin,
  listGroupsForAdmin,
  listEventsForAdmin,
  listBoostRequests,
  approveBoostRequest,
  rejectBoostRequest,
  setGroupBoosted,
  setEventBoosted,
  setGroupBoostedUntil,
  setEventBoostedUntil,
  deleteGroupAdmin,
  deleteEventAdmin,
  listCategoriesForAdmin,
  createCategoryAdmin,
  updateCategoryAdmin,
  deleteCategoryAdmin,
  type SiteAdminUserRow,
  type SiteAdminGroupRow,
  type SiteAdminEventRow,
  type BoostRequestRow,
  type SiteAdminCategoryRow,
} from "@/lib/site-admin";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { t } from "@/lib/i18n";

type TabId = "users" | "groups" | "events" | "boost" | "categories";

export default function ManageDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = React.useState<TabId>(() => {
    if (["users", "groups", "events", "boost", "categories"].includes(tabFromUrl ?? "")) return tabFromUrl as TabId;
    return "users";
  });

  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "users" || tabParam === "groups" || tabParam === "events" || tabParam === "boost" || tabParam === "categories") setTab(tabParam);
  }, [searchParams]);

  return (
    <main className="min-h-screen border-b bg-background">
      <div className="container px-4 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("siteAdmin.title")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary-green">{t("siteAdmin.dashboard")}</h1>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">{t("siteAdmin.backToSite")}</Link>
          </Button>
        </div>

        <nav className="mt-6 flex gap-1 border-b">
          {[
            { id: "users" as const, label: t("siteAdmin.users") },
            { id: "groups" as const, label: t("siteAdmin.allGroups") },
            { id: "events" as const, label: t("siteAdmin.events") },
            { id: "boost" as const, label: t("siteAdmin.boostRequests") },
            { id: "categories" as const, label: t("siteAdmin.categories") },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                router.replace(`/manage?tab=${id}`, { scroll: false });
              }}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "border border-b-0 border-b-background bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="py-6">
          {tab === "users" && <UsersTab />}
          {tab === "groups" && <GroupsTab />}
          {tab === "events" && <EventsTab />}
          {tab === "boost" && <BoostTab />}
          {tab === "categories" && <CategoriesTab />}
        </div>
      </div>
    </main>
  );
}

function UsersTab() {
  const [users, setUsers] = React.useState<SiteAdminUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("");
  const [sort, setSort] = React.useState<"joined" | "name" | "email">("joined");

  React.useEffect(() => {
    listUsersForAdmin().then(setUsers).finally(() => setLoading(false));
  }, []);

  const filtered = React.useMemo(() => {
    let list = users;
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = list.filter(
        (u) =>
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.phone_number ?? "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "name") return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      if (sort === "email") return (a.email ?? "").localeCompare(b.email ?? "");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [users, filter, sort]);

  if (loading) return <p className="text-muted-foreground">{t("siteAdmin.loadingUsers")}</p>;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary-green">{t("siteAdmin.users")}</h2>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder={t("siteAdmin.filterByNameEmailPhone")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-full border border-input bg-background px-4 py-1.5 text-sm w-64"
        />
        <span className="text-sm text-muted-foreground">{t("siteAdmin.sort")}</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "joined" | "name" | "email")}
          className="rounded-full border border-input bg-background px-4 py-1.5 text-sm"
        >
          <option value="joined">{t("siteAdmin.joinedNewest")}</option>
          <option value="name">{t("siteAdmin.name")}</option>
          <option value="email">{t("siteAdmin.email")}</option>
        </select>
      </div>
      <div className="rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">{t("siteAdmin.name")}</th>
              <th className="text-left p-3 font-medium">{t("siteAdmin.email")}</th>
              <th className="text-left p-3 font-medium">{t("siteAdmin.phone")}</th>
              <th className="text-left p-3 font-medium">{t("siteAdmin.joined")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.full_name || "—"}</td>
                <td className="p-3">{u.email || "—"}</td>
                <td className="p-3">{u.phone_number || "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupsTab() {
  const [groups, setGroups] = React.useState<SiteAdminGroupRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("");
  const [sort, setSort] = React.useState<"created" | "name" | "nameDesc" | "members" | "membersAsc">("created");
  const [untilEdit, setUntilEdit] = React.useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  function load() {
    setLoading(true);
    listGroupsForAdmin().then(setGroups).finally(() => setLoading(false));
  }

  React.useEffect(() => {
    load();
  }, []);

  const boostedGroups = React.useMemo(() => groups.filter((g) => g.is_boosted), [groups]);

  const filtered = React.useMemo(() => {
    let list = groups;
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "nameDesc") return b.name.localeCompare(a.name);
      if (sort === "members") return b.memberCount - a.memberCount;
      if (sort === "membersAsc") return a.memberCount - b.memberCount;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [groups, filter, sort]);

  const handleBoost = async (id: string, current: boolean) => {
    const ok = await setGroupBoosted(id, !current);
    if (ok) setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, is_boosted: !current } : g)));
  };

  const handleSetBoostedUntil = async (id: string, value: string | null) => {
    const ok = await setGroupBoostedUntil(id, value);
    if (ok) {
      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, boosted_until: value } : g)));
      setUntilEdit((e) => ({ ...e, [id]: "" }));
    }
  };

  async function doDeleteGroup(id: string) {
    setDeleteLoading(true);
    const ok = await deleteGroupAdmin(id);
    setDeleteLoading(false);
    setPendingDelete(null);
    if (ok) setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  if (loading) return <p className="text-muted-foreground">{t("siteAdmin.loadingGroups")}</p>;
  return (
    <div className="space-y-8">
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("siteAdmin.delete")}</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? t("siteAdmin.deleteGroupConfirm").replace("{{name}}", pendingDelete.name)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleteLoading}>
              {t("siteAdmin.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => pendingDelete && doDeleteGroup(pendingDelete.id)}
              disabled={deleteLoading}
            >
              {deleteLoading ? t("siteAdmin.deleting") : t("siteAdmin.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 스폿라이트 모임 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary-green">{t("siteAdmin.spotlightGroups")}</h2>
        <div className="rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("siteAdmin.name")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.members")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.boostedUntil")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {boostedGroups.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={4} className="p-4 text-muted-foreground text-center">
                    {t("siteAdmin.noSpotlightGroups")}
                  </td>
                </tr>
              ) : (
                boostedGroups.map((g) => (
                  <tr key={g.id} className="border-t">
                    <td className="p-3">
                      <Link href={`/groups/${g.id}`} className="text-point-coral hover:underline">
                        {g.name}
                      </Link>
                    </td>
                    <td className="p-3">{g.memberCount}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <DateInput
                          value={untilEdit[g.id] ?? g.boosted_until ?? ""}
                          onChange={(v) => setUntilEdit((prev) => ({ ...prev, [g.id]: v }))}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => handleSetBoostedUntil(g.id, (untilEdit[g.id] ?? g.boosted_until ?? "").trim() || null)}
                        >
                          {t("siteAdmin.set")}
                        </Button>
                        {g.boosted_until && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleSetBoostedUntil(g.id, null)}>
                            {t("siteAdmin.clear")}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" onClick={() => handleBoost(g.id, true)}>
                        {t("siteAdmin.unboost")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 전체모임 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary-green">{t("siteAdmin.allGroups")}</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder={t("siteAdmin.filterByName")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-full border border-input bg-background px-4 py-1.5 text-sm w-48"
          />
          <span className="text-sm text-muted-foreground">{t("siteAdmin.sort")}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "created" | "name" | "nameDesc" | "members" | "membersAsc")}
            className="rounded-full border border-input bg-background px-4 py-1.5 text-sm"
          >
            <option value="created">{t("siteAdmin.createdNewest")}</option>
            <option value="name">{t("siteAdmin.nameAZ")}</option>
            <option value="nameDesc">{t("siteAdmin.nameZA")}</option>
            <option value="members">{t("siteAdmin.membersDesc")}</option>
            <option value="membersAsc">{t("siteAdmin.membersAsc")}</option>
          </select>
        </div>
        <div className="rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("siteAdmin.name")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.members")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.createdDate")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="p-3">
                    <Link href={`/groups/${g.id}`} className="text-point-coral hover:underline">
                      {g.name}
                    </Link>
                  </td>
                  <td className="p-3">{g.memberCount}</td>
                  <td className="p-3 text-muted-foreground">
                    {g.created_at ? new Date(g.created_at).toLocaleDateString("ko-KR") : "—"}
                  </td>
                  <td className="p-3 flex gap-2">
                    {!g.is_boosted && (
                      <Button size="sm" variant="outline" onClick={() => handleBoost(g.id, false)}>
                        {t("siteAdmin.boost")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => setPendingDelete({ id: g.id, name: g.name })}
                    >
                      {t("siteAdmin.delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EventsTab() {
  const [events, setEvents] = React.useState<SiteAdminEventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("");
  const [sort, setSort] = React.useState<"title" | "start" | "created">("created");
  const [untilEdit, setUntilEdit] = React.useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = React.useState<{ id: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  function load() {
    setLoading(true);
    listEventsForAdmin().then(setEvents).finally(() => setLoading(false));
  }

  React.useEffect(() => {
    load();
  }, []);

  const boostedEvents = React.useMemo(() => events.filter((e) => e.is_boosted), [events]);

  const filtered = React.useMemo(() => {
    let list = events;
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "start") return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [events, filter, sort]);

  const handleBoost = async (id: string, current: boolean, startTime?: string) => {
    const ok = await setEventBoosted(id, !current);
    if (!ok) return;
    if (!current && startTime) {
      const start = new Date(startTime);
      start.setDate(start.getDate() - 1);
      const boostedUntil = start.toISOString().slice(0, 10);
      await setEventBoostedUntil(id, boostedUntil);
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, is_boosted: true, boosted_until: boostedUntil } : e))
      );
    } else {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_boosted: !current } : e)));
    }
  };

  const handleSetBoostedUntil = async (id: string, value: string | null) => {
    const ok = await setEventBoostedUntil(id, value);
    if (ok) {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, boosted_until: value } : e)));
      setUntilEdit((e) => ({ ...e, [id]: "" }));
    }
  };

  async function doDeleteEvent(id: string) {
    setDeleteLoading(true);
    const ok = await deleteEventAdmin(id);
    setDeleteLoading(false);
    setPendingDelete(null);
    if (ok) setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) return <p className="text-muted-foreground">{t("siteAdmin.loadingEvents")}</p>;
  return (
    <div className="space-y-8">
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("siteAdmin.delete")}</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? t("siteAdmin.deleteEventConfirm").replace("{{title}}", pendingDelete.title)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleteLoading}>
              {t("siteAdmin.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => pendingDelete && doDeleteEvent(pendingDelete.id)}
              disabled={deleteLoading}
            >
              {deleteLoading ? t("siteAdmin.deleting") : t("siteAdmin.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 스폿라이트 이벤트 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary-green">{t("siteAdmin.spotlightEvents")}</h2>
        <div className="rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("siteAdmin.eventTitle")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.startTime")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.boostedUntil")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {boostedEvents.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={4} className="p-4 text-muted-foreground text-center">
                    {t("siteAdmin.noSpotlightEvents")}
                  </td>
                </tr>
              ) : (
                boostedEvents.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3">
                      <Link href={`/events/${e.id}`} className="text-point-coral hover:underline">
                        {e.title}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {e.start_time ? new Date(e.start_time).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <DateInput
                          value={untilEdit[e.id] ?? e.boosted_until ?? ""}
                          onChange={(v) => setUntilEdit((prev) => ({ ...prev, [e.id]: v }))}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => handleSetBoostedUntil(e.id, (untilEdit[e.id] ?? e.boosted_until ?? "").trim() || null)}
                        >
                          {t("siteAdmin.set")}
                        </Button>
                        {e.boosted_until && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleSetBoostedUntil(e.id, null)}>
                            {t("siteAdmin.clear")}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" onClick={() => handleBoost(e.id, true)}>
                        {t("siteAdmin.unboost")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 전체 이벤트 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-primary-green">{t("siteAdmin.events")}</h2>
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <Button asChild size="sm">
            <Link href="/manage/events/new">{t("siteAdmin.createSpecialEvent")}</Link>
          </Button>
          <input
            type="text"
            placeholder={t("siteAdmin.filterByTitle")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-full border border-input bg-background px-4 py-1.5 text-sm w-48"
          />
          <span className="text-sm text-muted-foreground">{t("siteAdmin.sort")}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "title" | "start" | "created")}
            className="rounded-full border border-input bg-background px-4 py-1.5 text-sm"
          >
            <option value="created">{t("siteAdmin.createdNewest")}</option>
            <option value="title">{t("siteAdmin.eventTitle")}</option>
            <option value="start">{t("siteAdmin.startTime")}</option>
          </select>
        </div>
        <div className="rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("siteAdmin.eventTitle")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.startTime")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">
                    <Link href={`/events/${e.id}`} className="text-point-coral hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {e.start_time ? new Date(e.start_time).toLocaleString() : "—"}
                  </td>
                  <td className="p-3 flex gap-2">
                    {!e.is_boosted && (
                      <Button size="sm" variant="outline" onClick={() => handleBoost(e.id, false, e.start_time)}>
                        {t("siteAdmin.boost")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => setPendingDelete({ id: e.id, title: e.title })}
                    >
                      {t("siteAdmin.delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = React.useState<SiteAdminCategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addName, setAddName] = React.useState("");
  const [addNameKo, setAddNameKo] = React.useState("");
  const [addEmoji, setAddEmoji] = React.useState("📅");
  const [addSubmitting, setAddSubmitting] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<SiteAdminCategoryRow | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editNameKo, setEditNameKo] = React.useState("");
  const [editEmoji, setEditEmoji] = React.useState("");
  const [editSlug, setEditSlug] = React.useState("");
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<SiteAdminCategoryRow | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  function load() {
    setLoading(true);
    listCategoriesForAdmin().then(setCategories).finally(() => setLoading(false));
  }

  React.useEffect(() => {
    load();
  }, []);

  React.useEffect(() => {
    if (editing) {
      setEditName(editing.name);
      setEditNameKo(editing.name_ko ?? "");
      setEditEmoji(editing.emoji ?? "📅");
      setEditSlug(editing.slug);
    }
  }, [editing]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const name = addName.trim();
    if (!name) {
      setAddError(t("siteAdmin.categoryNameEnRequired"));
      return;
    }
    setAddSubmitting(true);
    const result = await createCategoryAdmin({
      name,
      name_ko: addNameKo.trim() || null,
      emoji: addEmoji.trim() || "📅",
    });
    setAddSubmitting(false);
    if (result.ok) {
      setAddName("");
      setAddNameKo("");
      setAddEmoji("📅");
      load();
    } else {
      setAddError(result.error);
    }
  }

  async function handleEditSave() {
    if (!editing) return;
    setEditSubmitting(true);
    const ok = await updateCategoryAdmin(editing.id, {
      name: editName.trim(),
      name_ko: editNameKo.trim() || null,
      emoji: editEmoji.trim() || "📅",
      slug: editSlug.trim(),
    });
    setEditSubmitting(false);
    if (ok) {
      setEditing(null);
      load();
    }
  }

  async function doDelete(id: string) {
    setDeleteLoading(true);
    const result = await deleteCategoryAdmin(id);
    setDeleteLoading(false);
    setPendingDelete(null);
    if (result.ok) load();
    else alert(result.error);
  }

  if (loading) return <p className="text-muted-foreground">{t("siteAdmin.loadingCategories")}</p>;
  return (
    <div className="space-y-8">
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("siteAdmin.editCategory")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t("siteAdmin.categoryNameEn")}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full" />
            </div>
            <div className="space-y-1">
              <Label>{t("siteAdmin.categoryNameKo")}</Label>
              <Input value={editNameKo} onChange={(e) => setEditNameKo(e.target.value)} className="w-full" />
            </div>
            <div className="space-y-1">
              <Label>{t("siteAdmin.categoryEmoji")}</Label>
              <Input value={editEmoji} onChange={(e) => setEditEmoji(e.target.value)} className="w-full" placeholder="📅" />
            </div>
            <div className="space-y-1">
              <Label>{t("siteAdmin.categorySlug")}</Label>
              <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="w-full" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={editSubmitting}>
              {t("siteAdmin.cancel")}
            </Button>
            <Button type="button" onClick={handleEditSave} disabled={editSubmitting}>
              {editSubmitting ? t("siteAdmin.deleting") : t("siteAdmin.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("siteAdmin.delete")}</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? t("siteAdmin.deleteCategoryConfirm").replace("{{name}}", pendingDelete.name)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleteLoading}>
              {t("siteAdmin.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => pendingDelete && doDelete(pendingDelete.id)}
              disabled={deleteLoading}
            >
              {deleteLoading ? t("siteAdmin.deleting") : t("siteAdmin.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <h2 className="text-lg font-semibold text-primary-green">{t("siteAdmin.categories")}</h2>

      <section className="space-y-3">
        <h3 className="font-medium">{t("siteAdmin.addCategory")}</h3>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="cat-add-name">{t("siteAdmin.categoryNameEn")}</Label>
            <Input
              id="cat-add-name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Tech"
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-add-name-ko">{t("siteAdmin.categoryNameKo")}</Label>
            <Input
              id="cat-add-name-ko"
              value={addNameKo}
              onChange={(e) => setAddNameKo(e.target.value)}
              placeholder="예: 테크"
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cat-add-emoji">{t("siteAdmin.categoryEmoji")}</Label>
            <Input
              id="cat-add-emoji"
              value={addEmoji}
              onChange={(e) => setAddEmoji(e.target.value)}
              placeholder="📅"
              className="w-24"
            />
          </div>
          <Button type="submit" variant="green" disabled={addSubmitting}>
            {addSubmitting ? t("siteAdmin.addingCategory") : t("siteAdmin.addCategory")}
          </Button>
        </form>
        {addError && <p className="text-xs text-destructive">{addError}</p>}
      </section>

      <section className="space-y-3">
        <div className="rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("siteAdmin.categoryEmoji")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.categoryNameEn")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.categoryNameKo")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.categorySlug")}</th>
                <th className="text-left p-3 font-medium">{t("siteAdmin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={5} className="p-4 text-muted-foreground text-center">
                    {t("siteAdmin.noCategoriesYet")}
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3">{c.emoji || "📅"}</td>
                    <td className="p-3">{c.name}</td>
                    <td className="p-3">{c.name_ko ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.slug}</td>
                    <td className="p-3 flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(c)}>
                        {t("siteAdmin.editCategory")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => setPendingDelete(c)}
                      >
                        {t("siteAdmin.delete")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BoostTab() {
  const [requests, setRequests] = React.useState<BoostRequestRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"pending" | "all">("pending");
  const [sort, setSort] = React.useState<"created" | "status" | "type">("created");

  function load() {
    setLoading(true);
    listBoostRequests(filter === "pending" ? "pending" : undefined).then(setRequests).finally(() => setLoading(false));
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable; run when filter changes
  }, [filter]);

  const sorted = React.useMemo(() => {
    const list = [...requests];
    if (sort === "created") list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === "status") list.sort((a, b) => a.status.localeCompare(b.status));
    else if (sort === "type") list.sort((a, b) => a.type.localeCompare(b.type));
    return list;
  }, [requests, sort]);

  const currentUserId = React.useRef<string | null>(null);
  React.useEffect(() => {
    getCurrentUserProfile().then((p) => { currentUserId.current = p?.id ?? null; });
  }, []);

  const handleApprove = async (id: string) => {
    const uid = currentUserId.current;
    if (!uid) return;
    const result = await approveBoostRequest(id, uid);
    if (result.ok) load();
    else alert(result.error);
  };

  const handleReject = async (id: string) => {
    const uid = currentUserId.current;
    if (!uid) return;
    const result = await rejectBoostRequest(id, uid);
    if (result.ok) load();
    else alert(result.error);
  };

  if (loading) return <p className="text-muted-foreground">{t("siteAdmin.loadingBoostRequests")}</p>;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary-green">{t("siteAdmin.boostRequests")}</h2>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === "pending" ? "bg-primary-green text-white" : "bg-muted"}`}
        >
          {t("siteAdmin.pending")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === "all" ? "bg-primary-green text-white" : "bg-muted"}`}
        >
          {t("siteAdmin.all")}
        </button>
        <span className="text-sm text-muted-foreground">{t("siteAdmin.sort")}</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "created" | "status" | "type")}
          className="rounded-full border border-input bg-background px-4 py-1.5 text-sm"
        >
          <option value="created">{t("siteAdmin.createdNewest")}</option>
          <option value="status">{t("siteAdmin.status")}</option>
          <option value="type">{t("siteAdmin.type")}</option>
        </select>
      </div>
      <div className="rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">{t("siteAdmin.type")}</th>
              <th className="text-left p-3 font-medium">{t("siteAdmin.item")}</th>
              <th className="text-left p-3 font-medium">{t("siteAdmin.requestedBy")}</th>
              <th className="text-left p-3 font-medium">{t("siteAdmin.boostEndDate")}</th>
              <th className="text-left p-3 font-medium">{t("siteAdmin.status")}</th>
              {filter === "pending" && <th className="text-left p-3 font-medium">{t("siteAdmin.actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 capitalize">{r.type}</td>
                <td className="p-3">
                  {r.type === "group" ? (
                    <Link href={`/groups/${r.entity_id}`} className="text-point-coral hover:underline">
                      {r.entity_title || r.entity_id}
                    </Link>
                  ) : (
                    <Link href={`/events/${r.entity_id}`} className="text-point-coral hover:underline">
                      {r.entity_title || r.entity_id}
                    </Link>
                  )}
                </td>
                <td className="p-3">{r.requester_name || r.requested_by}</td>
                <td className="p-3">{r.boost_end_date ? new Date(r.boost_end_date).toLocaleDateString() : "—"}</td>
                <td className="p-3 capitalize">{r.status}</td>
                {filter === "pending" && (
                  <td className="p-3 flex gap-2">
                    <Button size="sm" variant="green" onClick={() => handleApprove(r.id)}>{t("siteAdmin.approve")}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(r.id)}>{t("siteAdmin.reject")}</Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {requests.length === 0 && (
        <p className="text-muted-foreground">{filter === "pending" ? t("siteAdmin.noPendingBoostRequests") : t("siteAdmin.noBoostRequests")}</p>
      )}
    </div>
  );
}
