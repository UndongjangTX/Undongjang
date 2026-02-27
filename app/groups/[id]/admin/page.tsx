"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getGroupById, canManageGroup, isGroupOwner, type GroupDetailData } from "@/lib/groups";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { GroupAdminDetails } from "@/components/group-admin-details";
import { GroupAdminMembers } from "@/components/group-admin-members";
import { GroupAdminEvents } from "@/components/group-admin-events";
import { GroupAdminPhotos } from "@/components/group-admin-photos";
import { GroupAdminMessages } from "@/components/group-admin-messages";
import { t } from "@/lib/i18n";

type TabId = "details" | "members" | "events" | "photos" | "messages";

export default function GroupAdminPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [group, setGroup] = React.useState<GroupDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [unauthorized, setUnauthorized] = React.useState(false);
  const [isOwner, setIsOwner] = React.useState(false);
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = React.useState<TabId>(() => {
    if (tabFromUrl === "members" || tabFromUrl === "events" || tabFromUrl === "photos" || tabFromUrl === "messages") return tabFromUrl;
    return "details";
  });

  React.useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "members" || t === "events" || t === "photos" || t === "messages") setTab(t);
    else setTab("details");
  }, [searchParams]);

  React.useEffect(() => {
    (async () => {
      const [groupData, profile] = await Promise.all([
        getGroupById(params.id),
        getCurrentUserProfile(),
      ]);
      if (!groupData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!profile?.id || !(await canManageGroup(params.id, profile.id))) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      setGroup(groupData);
      setIsOwner(await isGroupOwner(params.id, profile.id));
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{t("siteAdmin.loading")}</p>
      </main>
    );
  }
  if (notFound || !group) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">{t("groupAdminPage.groupNotFound")}</p>
        <Button asChild variant="outline">
          <Link href="/groups">{t("groupAdminPage.backToGroups")}</Link>
        </Button>
      </main>
    );
  }
  if (unauthorized) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">{t("groupAdminPage.onlyOwnerCanManage")}</p>
        <Button asChild variant="outline">
          <Link href={`/groups/${params.id}`}>{t("groupAdminPage.backToGroup")}</Link>
        </Button>
      </main>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "details", label: t("groupAdminPage.details") },
    { id: "members", label: t("groupAdminPage.members") },
    { id: "events", label: t("groupAdminPage.events") },
    { id: "photos", label: t("groupAdminPage.photos") },
    { id: "messages", label: t("groupAdminPage.messages") },
  ];

  return (
    <main className="min-h-screen border-b">
      <div className="container px-4 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("groupAdminPage.manageGroup")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{group.name}</h1>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/groups/${params.id}`}>{t("groupAdminPage.viewGroupPage")}</Link>
          </Button>
        </div>

        <nav className="mt-6 flex gap-1 border-b">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                router.replace(`/groups/${params.id}/admin?tab=${id}`, { scroll: false });
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
          {tab === "details" && (
            <GroupAdminDetails
              group={group}
              isOwner={isOwner}
              onDeleted={() => getGroupById(params.id).then((data) => data && setGroup(data))}
              onRestored={() => getGroupById(params.id).then((data) => data && setGroup(data))}
            />
          )}
          {tab === "members" && (
            <GroupAdminMembers groupId={params.id} isOwner={isOwner} isPrivate={group.isPrivate} />
          )}
          {tab === "events" && <GroupAdminEvents groupId={params.id} groupName={group.name} />}
          {tab === "photos" && <GroupAdminPhotos groupId={params.id} />}
          {tab === "messages" && <GroupAdminMessages groupId={params.id} />}
        </div>
      </div>
    </main>
  );
}
