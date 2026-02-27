"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getEventAttendees, type EventAttendeeRow } from "@/lib/events";
import {
  getEventInvites,
  inviteToEventByEmail,
  cancelEventInvite,
  getEventAdmins,
  createEventAdminInvite,
  acceptEventAdminInvite,
  getPendingEventAdminInvitesForUser,
  transferEventToGroup,
  isEventHostGroupOwner,
  type EventInviteRow,
} from "@/lib/event-admin";
import { getGroupsOrganizedByUser } from "@/lib/groups";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { t } from "@/lib/i18n";

function parseEmails(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function EventAdminAttendees({
  eventId,
  hostGroupId,
}: {
  eventId: string;
  hostGroupId?: string | null;
}) {
  const [attendees, setAttendees] = React.useState<EventAttendeeRow[]>([]);
  const [invites, setInvites] = React.useState<EventInviteRow[]>([]);
  const [admins, setAdmins] = React.useState<Awaited<ReturnType<typeof getEventAdmins>>>([]);
  const [loading, setLoading] = React.useState(true);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isOwner, setIsOwner] = React.useState(false);
  const [organizedGroups, setOrganizedGroups] = React.useState<Awaited<ReturnType<typeof getGroupsOrganizedByUser>>>([]);
  const [transferGroupId, setTransferGroupId] = React.useState("");
  const [transferLoading, setTransferLoading] = React.useState(false);
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminInviteLoading, setAdminInviteLoading] = React.useState(false);
  const [pendingAdminInvite, setPendingAdminInvite] = React.useState<{ id: string; event_title: string } | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      getEventAttendees(eventId),
      getEventInvites(eventId),
      getEventAdmins(eventId),
    ]).then(([a, i, ad]) => {
      setAttendees(a);
      setInvites(i);
      setAdmins(ad);
      setLoading(false);
    });
  }

  React.useEffect(() => {
    load();
    getCurrentUserProfile().then(async (profile) => {
      const uid = profile?.id ?? null;
      setCurrentUserId(uid);
      if (!uid) return;
      const [owner, groups, pending] = await Promise.all([
        isEventHostGroupOwner(eventId, uid),
        getGroupsOrganizedByUser(uid),
        getPendingEventAdminInvitesForUser(uid),
      ]);
      setIsOwner(owner);
      setOrganizedGroups(groups);
      const forThis = pending.find((p) => p.event_id === eventId);
      setPendingAdminInvite(forThis ? { id: forThis.id, event_title: forThis.event_title } : null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only when eventId changes
  }, [eventId]);

  async function handleRemove(userId: string) {
    setRemoving(userId);
    const supabase = createClient();
    const { error } = await supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
    setRemoving(null);
    if (!error) load();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const emails = parseEmails(inviteEmail);
    if (emails.length === 0 || !currentUserId) {
      setInviteError(t("admin.inviteErrorEnterEmails"));
      return;
    }
    setInviteLoading(true);
    const results = await Promise.all(
      emails.map((email) => inviteToEventByEmail(eventId, email, currentUserId))
    );
    setInviteLoading(false);
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (ok > 0) {
      setInviteEmail("");
      setMessage({
        type: "success",
        text:
          ok === emails.length
            ? t("admin.invitesSent")
            : t("admin.invitePartialSuccess").replace("{{ok}}", String(ok)).replace("{{failed}}", String(failed.length)),
      });
      load();
    }
    if (failed.length > 0) {
      setInviteError(
        failed.map((r) => (r as { error: string }).error).join("; ") +
          (emails.length > 1 ? ` (${failed.length} of ${emails.length})` : "")
      );
    }
  }

  async function handleCancelInvite(inviteId: string) {
    const ok = await cancelEventInvite(eventId, inviteId);
    if (ok) load();
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !transferGroupId.trim()) return;
    setTransferLoading(true);
    const result = await transferEventToGroup(eventId, transferGroupId, currentUserId);
    setTransferLoading(false);
    if (result.ok) {
      setTransferGroupId("");
      setMessage({ type: "success", text: t("admin.eventTransferred") });
      window.location.reload();
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  async function handleAdminInvite(e: React.FormEvent) {
    e.preventDefault();
    const emails = parseEmails(adminEmail);
    if (!currentUserId || emails.length === 0) return;
    setAdminInviteLoading(true);
    const supabase = createClient();
    const results = await Promise.all(
      emails.map(async (email) => {
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (!user) return { ok: false as const, error: t("admin.noAccountEmail").replace("{{email}}", email) };
        return createEventAdminInvite(eventId, currentUserId, user.id);
      })
    );
    setAdminInviteLoading(false);
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (ok > 0) {
      setAdminEmail("");
      setMessage({
        type: "success",
        text:
          ok === emails.length
            ? t("admin.adminInvitesSent")
            : t("admin.adminInvitePartialSuccess").replace("{{ok}}", String(ok)).replace("{{failed}}", String(failed.length)),
      });
    }
    if (failed.length > 0) {
      setMessage({
        type: "error",
        text: failed.map((r) => (r as { error: string }).error).join("; "),
      });
    }
  }

  async function handleAcceptAdminInvite() {
    if (!currentUserId || !pendingAdminInvite) return;
    const result = await acceptEventAdminInvite(pendingAdminInvite.id, currentUserId);
    if (result.ok) {
      setPendingAdminInvite(null);
      setMessage({ type: "success", text: t("admin.youAreNowEventAdmin") });
      load();
    } else {
      setMessage({ type: "error", text: result.error });
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("admin.loadingAttendees")}</p>;
  }

  const groupsForTransfer = hostGroupId
    ? organizedGroups.filter((g) => g.id !== hostGroupId)
    : organizedGroups;

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">{t("eventAdminPage.attendees")}</h2>

      {pendingAdminInvite && (
        <section className="rounded-lg border border-primary-green/50 bg-primary-green/5 p-4 space-y-3">
          <h3 className="font-medium">{t("admin.pendingActions")}</h3>
          <p className="text-sm">
            {t("admin.invitedAsAdmin")}
            <span className="ml-2">
              <Button size="sm" variant="green" onClick={handleAcceptAdminInvite}>
                {t("admin.acceptAdminRole")}
              </Button>
            </span>
          </p>
        </section>
      )}

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-primary-green" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="font-medium">{t("admin.inviteByEmail")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("admin.inviteDescription")}
        </p>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 min-w-0 flex-1 max-w-md">
            <Label htmlFor="invite-email" className="sr-only">
              {t("admin.inviteEmailLabel")}
            </Label>
            <Input
              id="invite-email"
              type="text"
              placeholder={t("admin.invitePlaceholder")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full"
            />
          </div>
          <Button type="submit" variant="green" disabled={inviteLoading}>
            {inviteLoading ? t("admin.adding") : t("admin.invite")}
          </Button>
        </form>
        {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
      </section>

      {invites.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium">{t("admin.pendingApproval")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("admin.pendingApprovalDesc")}
          </p>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
              >
                <span>{inv.email}</span>
                <Button size="sm" variant="outline" onClick={() => handleCancelInvite(inv.id)}>
                  {t("admin.cancelInvite")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-medium">{t("admin.currentAttendees")} ({attendees.length})</h3>
        {attendees.length === 0 ? (
          <p className="text-muted-foreground">{t("admin.noAttendeesYet")}</p>
        ) : (
          <ul className="divide-y rounded-2xl border max-w-xl">
            {attendees.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.full_name || t("admin.unknown")}</span>
                  {a.isHost && (
                    <span className="rounded-full bg-primary-green/20 px-2 py-0.5 text-xs font-medium text-primary-green">
                      {t("admin.host")}
                    </span>
                  )}
                </span>
                {!a.isHost && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemove(a.user_id)}
                    disabled={removing === a.user_id}
                  >
                    {removing === a.user_id ? t("admin.removing") : t("admin.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <>
          <section className="space-y-3 border-t pt-6">
            <h3 className="font-medium">{t("admin.transferEvent")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("admin.transferEventDesc")}
            </p>
            <form onSubmit={handleTransfer} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 min-w-0 flex-1 max-w-md">
                <Label htmlFor="transfer-group" className="sr-only">
                  {t("admin.newHostGroup")}
                </Label>
                <select
                  id="transfer-group"
                  value={transferGroupId}
                  onChange={(e) => setTransferGroupId(e.target.value)}
                  className="flex h-9 w-full max-w-md rounded-full border border-input bg-transparent px-4 py-1 text-sm"
                >
                  <option value="">{t("admin.selectGroupYouOrganize")}</option>
                  {groupsForTransfer.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="outline" disabled={transferLoading || !transferGroupId}>
                {transferLoading ? t("admin.transferring") : t("admin.transfer")}
              </Button>
            </form>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h3 className="font-medium">{t("admin.assignEventAdmin")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("admin.assignEventAdminDesc")}
            </p>
            <form onSubmit={handleAdminInvite} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 min-w-0 flex-1 max-w-md">
                <Label htmlFor="admin-email" className="sr-only">
                  {t("admin.adminEmailLabel")}
                </Label>
                <Input
                  id="admin-email"
                  type="text"
                  placeholder={t("admin.adminEmailPlaceholder")}
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button type="submit" variant="outline" disabled={adminInviteLoading}>
                {adminInviteLoading ? t("admin.sending") : t("admin.inviteAsAdmin")}
              </Button>
            </form>
            {admins.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("admin.currentAdmins")}: {admins.map((a) => a.full_name || a.user_id).join(", ")}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
