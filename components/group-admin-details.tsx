"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { requestGroupDeletion, restoreGroup } from "@/lib/group-admin";
import { ConfirmDestructiveDialog, randomConfirmString } from "@/components/confirm-destructive-dialog";
import type { GroupDetailData } from "@/lib/groups";
import { t } from "@/lib/i18n";
import { getCategoryDisplayName } from "@/lib/category-labels";

const schema = z.object({
  name: z.string().min(1, t("groupForm.nameRequired")),
  description: z.string().optional(),
  group_category_id: z.string().min(1, t("groupForm.categoryRequired")),
});

type FormValues = z.infer<typeof schema>;

type Category = { id: string; name: string; slug: string; name_ko?: string | null };

export function GroupAdminDetails({
  group,
  isOwner,
  onDeleted,
  onRestored,
}: {
  group: GroupDetailData;
  isOwner: boolean;
  onDeleted?: () => void;
  onRestored?: () => void;
}) {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteConfirmStr, setDeleteConfirmStr] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [restoreLoading, setRestoreLoading] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: group.name,
      description: group.description ?? "",
      group_category_id: group.groupCategoryId ?? "",
    },
  });

  React.useEffect(() => {
    form.reset({
      name: group.name,
      description: group.description ?? "",
      group_category_id: group.groupCategoryId ?? "",
    });
  }, [group.id, group.name, group.description, group.groupCategoryId, form]);

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("id, name, name_ko, slug, emoji")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  async function onSubmit(values: FormValues) {
    if (!isOwner) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("groups")
      .update({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        group_category_id: values.group_category_id || null,
      })
      .eq("id", group.id);

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: "Group details updated." });
  }

  function openDeleteDialog() {
    setDeleteConfirmStr(randomConfirmString());
    setDeleteDialogOpen(true);
  }

  async function handleRequestDelete() {
    if (!isOwner) return;
    setDeleteLoading(true);
    const profile = await import("@/lib/user-profile").then((m) => m.getCurrentUserProfile());
    const userId = profile?.id;
    if (!userId) {
      setDeleteLoading(false);
      return;
    }
    const result = await requestGroupDeletion(group.id, userId);
    setDeleteLoading(false);
    if (result.ok) onDeleted?.();
    else setMessage({ type: "error", text: result.error });
  }

  async function handleRestore() {
    if (!isOwner) return;
    setRestoreLoading(true);
    const profile = await import("@/lib/user-profile").then((m) => m.getCurrentUserProfile());
    const userId = profile?.id;
    if (!userId) {
      setRestoreLoading(false);
      return;
    }
    const result = await restoreGroup(group.id, userId);
    setRestoreLoading(false);
    if (result.ok) onRestored?.();
    else setMessage({ type: "error", text: result.error });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("admin.groupDetails")}</h2>
      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-primary-green" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}

      {isOwner ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("admin.groupNameLabel")}</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="e.g. Running Club"
              className="max-w-md"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">About</Label>
            <textarea
              id="description"
              {...form.register("description")}
              rows={4}
              className="textarea-rounded-box max-w-md"
              placeholder="What is this group about?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group_category_id">{t("admin.groupCategoryLabel")}</Label>
            <select
              id="group_category_id"
              {...form.register("group_category_id")}
              className="flex h-9 w-full max-w-md rounded-full border border-input bg-transparent px-4 py-1 text-sm"
            >
              <option value="">{t("admin.selectCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {getCategoryDisplayName(c.name, c.name_ko ?? undefined)}
                </option>
              ))}
            </select>
            {form.formState.errors.group_category_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.group_category_id.message}
              </p>
            )}
          </div>
          <Button type="submit" variant="green" disabled={saving}>
            {saving ? t("admin.saving") : t("admin.saveChanges")}
          </Button>
        </form>
      ) : (
        <div className="max-w-xl space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("admin.groupNameLabel")}</p>
            <p className="mt-1">{group.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">About</p>
            <p className="mt-1 text-sm">{group.description || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Category</p>
            <p className="mt-1">{group.categoryDisplayName ?? "—"}</p>
          </div>
          <p className="text-sm text-muted-foreground">{t("misc.onlyOwnerAdmins")}</p>
        </div>
      )}

      {isOwner && (
        <div className="mt-10 pt-8 border-t space-y-4">
          <h3 className="text-lg font-semibold text-destructive">{t("admin.dangerZone")}</h3>
          {group.deleted_at ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-2">
              <p className="text-sm font-medium">{t("admin.scheduledForDeletion")}</p>
              <p className="text-sm text-muted-foreground">
                You can restore it within 7 days. After that it will be permanently deleted.
              </p>
              <Button variant="green" onClick={handleRestore} disabled={restoreLoading}>
                {restoreLoading ? t("admin.restoring") : t("admin.restoreGroup")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Deleting the group will hide it immediately. You can restore it within 7 days from this page. Boosted status will be removed.
              </p>
              <Button variant="destructive" onClick={openDeleteDialog}>
                Delete group
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDestructiveDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this group?"
        description={
          <>
            <p>{t("admin.deleteGroupDesc")}</p>
            <p className="font-medium text-foreground">{t("admin.restoreWithin7Days")}</p>
          </>
        }
        confirmLabel={t("admin.deleteGroupConfirmLabel")}
        confirmString={deleteConfirmStr}
        onConfirm={handleRequestDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
