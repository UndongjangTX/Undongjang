"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getGroupMembers,
  getJoinRequests,
  inviteMemberByEmail,
  kickMember,
  acceptJoinRequest,
  rejectJoinRequest,
  createOwnershipTransfer,
  createAdminInvite,
  acceptOwnershipTransfer,
  acceptAdminInvite,
  getPendingTransfersForUser,
  getPendingAdminInvitesForUser,
  type GroupMemberRow,
  type JoinRequestRow,
} from "@/lib/group-admin";
import { getGroupById } from "@/lib/groups";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

export function GroupAdminMembers({
  groupId,
  isOwner,
  isPrivate,
}: {
  groupId: string;
  isOwner: boolean;
  isPrivate: boolean;
}) {
  const [members, setMembers] = React.useState<GroupMemberRow[]>([]);
  const [joinRequests, setJoinRequests] = React.useState<JoinRequestRow[]>([]);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [group, setGroup] = React.useState<{ name: string; organizerId: string | null } | null>(null);
  const [transferEmail, setTransferEmail] = React.useState("");
  const [transferLoading, setTransferLoading] = React.useState(false);
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminInviteLoading, setAdminInviteLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingTransfer, setPendingTransfer] = React.useState<{ id: string; group_name: string } | null>(null);
  const [pendingAdminInvite, setPendingAdminInvite] = React.useState<{ id: string; group_name: string } | null>(null);

  function load() {
    getGroupMembers(groupId).then(setMembers);
    if (isPrivate) getJoinRequests(groupId).then(setJoinRequests);
    getGroupById(groupId).then((g) => g && setGroup({ name: g.name, organizerId: g.organizerId }));
  }

  React.useEffect(() => {
    load();
    getCurrentUserProfile().then(async (p) => {
      const uid = p?.id ?? null;
      setCurrentUserId(uid);
      if (!uid) return;
      const [transfers, invites] = await Promise.all([
        getPendingTransfersForUser(uid),
        getPendingAdminInvitesForUser(uid),
      ]);
      const t = transfers.find((x) => x.group_id === groupId);
      const i = invites.find((x) => x.group_id === groupId);
      setPendingTransfer(t ? { id: t.id, group_name: t.group_name } : null);
      setPendingAdminInvite(i ? { id: i.id, group_name: i.group_name } : null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only when groupId/isPrivate change
  }, [groupId, isPrivate]);

  function parseEmails(input: string): string[] {
    return input
      .split(/[\s,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const emails = parseEmails(inviteEmail);
    if (emails.length === 0) {
      setInviteError("Enter one or more email addresses (comma-separated).");
      return;
    }
    setInviteLoading(true);
    const results = await Promise.all(emails.map((email) => inviteMemberByEmail(groupId, email)));
    setInviteLoading(false);
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (ok > 0) {
      setInviteEmail("");
      setMessage({ type: "success", text: ok === emails.length ? "All invited." : `Added ${ok}. ${failed.length} failed.` });
      load();
    }
    if (failed.length > 0) {
      setInviteError(failed.map((r) => (r as { error: string }).error).join("; ") + (emails.length > 1 ? ` (${failed.length} of ${emails.length})` : ""));
    }
  }

  async function handleKick(userId: string) {
    if (!currentUserId) return;
    const result = await kickMember(groupId, userId, currentUserId);
    if (result.ok) load();
    else setMessage({ type: "error", text: result.error });
  }

  async function handleAcceptRequest(requestId: string) {
    const result = await acceptJoinRequest(requestId, groupId);
    if (result.ok) {
      setMessage({ type: "success", text: "Member added." });
      load();
    } else setMessage({ type: "error", text: result.error });
  }

  async function handleRejectRequest(requestId: string) {
    await rejectJoinRequest(requestId, groupId);
    load();
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    const emails = parseEmails(transferEmail);
    if (!currentUserId || emails.length === 0) return;
    setTransferLoading(true);
    const supabase = createClient();
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .ilike("email", emails[0])
      .maybeSingle();
    setTransferLoading(false);
    if (!user) {
      setMessage({ type: "error", text: "No account found with this email." });
      return;
    }
    const result = await createOwnershipTransfer(groupId, currentUserId, user.id);
    if (result.ok) {
      setTransferEmail("");
      setMessage({ type: "success", text: "Ownership transfer requested. They must accept." });
    } else setMessage({ type: "error", text: result.error });
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
        if (!user) return { ok: false as const, error: `No account: ${email}` };
        return createAdminInvite(groupId, currentUserId, user.id);
      })
    );
    setAdminInviteLoading(false);
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (ok > 0) {
      setAdminEmail("");
      setMessage({
        type: "success",
        text: ok === emails.length ? "Admin invites sent." : `Sent ${ok}. ${failed.length} failed.`,
      });
    }
    if (failed.length > 0) {
      setMessage({ type: "error", text: failed.map((r) => (r as { error: string }).error).join("; ") });
    }
  }

  async function handleAcceptTransfer() {
    if (!currentUserId || !pendingTransfer) return;
    const result = await acceptOwnershipTransfer(pendingTransfer.id, currentUserId);
    if (result.ok) {
      setPendingTransfer(null);
      setMessage({ type: "success", text: "You are now the owner. Refreshing..." });
      window.location.href = `/groups/${groupId}/admin?tab=members`;
    } else setMessage({ type: "error", text: result.error });
  }

  async function handleAcceptAdminInvite() {
    if (!currentUserId || !pendingAdminInvite) return;
    const result = await acceptAdminInvite(pendingAdminInvite.id, currentUserId);
    if (result.ok) {
      setPendingAdminInvite(null);
      setMessage({ type: "success", text: "You are now an admin." });
      load();
    } else setMessage({ type: "error", text: result.error });
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Members</h2>

      {(pendingTransfer || pendingAdminInvite) && (
        <section className="rounded-lg border border-primary-green/50 bg-primary-green/5 p-4 space-y-3">
          <h3 className="font-medium">{t("admin.pendingActions")}</h3>
          {pendingTransfer && (
            <p className="text-sm">
              You&apos;ve been asked to accept ownership of this group.
              <span className="ml-2">
                <Button size="sm" variant="green" onClick={handleAcceptTransfer}>
                  Accept ownership
                </Button>
              </span>
            </p>
          )}
          {pendingAdminInvite && (
            <p className="text-sm">
              You&apos;ve been invited to be an admin.
              <span className="ml-2">
                <Button size="sm" variant="green" onClick={handleAcceptAdminInvite}>
                  Accept admin role
                </Button>
              </span>
            </p>
          )}
        </section>
      )}

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-primary-green" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="font-medium">{t("admin.inviteByEmail")}</h3>
        <p className="text-sm text-muted-foreground">
          Enter one or more emails separated by commas. Invited people are added as members immediately.
        </p>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 min-w-0 flex-1 max-w-md">
            <Label htmlFor="invite-email" className="sr-only">
              Email (comma-separated for multiple)
            </Label>
            <Input
              id="invite-email"
              type="text"
              placeholder="email@example.com, another@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full"
            />
          </div>
          <Button type="submit" variant="green" disabled={inviteLoading}>
            {inviteLoading ? "Adding..." : "Invite"}
          </Button>
        </form>
        {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
      </section>

      {isPrivate && (
        <section className="space-y-3">
          <h3 className="font-medium">{t("admin.pendingApproval")}</h3>
          <p className="text-sm text-muted-foreground">
            Join requests for this private group. Accept to add them as members.
          </p>
          {joinRequests.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              No pending requests.
            </p>
          ) : (
            <ul className="space-y-2">
              {joinRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
                >
                  <span>{req.full_name || req.user_id}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="green"
                      onClick={() => handleAcceptRequest(req.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectRequest(req.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-medium">{t("admin.currentMembers")} ({members.length})</h3>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
            >
              <span>{m.full_name || m.user_id}</span>
              <div className="flex items-center gap-2">
                {group?.organizerId === m.user_id && (
                  <span className="text-xs font-medium text-muted-foreground">Owner</span>
                )}
                {currentUserId !== m.user_id &&
                  group?.organizerId !== m.user_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleKick(m.user_id)}
                    >
                      Remove
                    </Button>
                  )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <>
          <section className="space-y-3 border-t pt-6">
            <h3 className="font-medium">{t("admin.transferOwnership")}</h3>
            <p className="text-sm text-muted-foreground">
              The person must have an account and will be notified to accept.
            </p>
            <form onSubmit={handleTransfer} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 min-w-0 flex-1 max-w-md">
                <Label htmlFor="transfer-email" className="sr-only">
                  New owner email (comma-separated for multiple; first valid used)
                </Label>
                <Input
                  id="transfer-email"
                  type="text"
                  placeholder="new-owner@example.com"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button type="submit" variant="outline" disabled={transferLoading}>
                {transferLoading ? t("admin.sending") : t("admin.requestTransfer")}
              </Button>
            </form>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h3 className="font-medium">{t("admin.assignAdmin")}</h3>
            <p className="text-sm text-muted-foreground">
              The person will be notified and must accept to become an admin.
            </p>
            <form onSubmit={handleAdminInvite} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 min-w-0 flex-1 max-w-md">
                <Label htmlFor="admin-email" className="sr-only">
                  Admin email (comma-separated; first valid used)
                </Label>
                <Input
                  id="admin-email"
                  type="text"
                  placeholder="admin@example.com, other@example.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button type="submit" variant="outline" disabled={adminInviteLoading}>
                {adminInviteLoading ? "Sending..." : "Invite as admin"}
              </Button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
