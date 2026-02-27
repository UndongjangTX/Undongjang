"use client";

import * as React from "react";
import Link from "next/link";
import { getCategoryDisplayName } from "@/lib/category-labels";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const COVERS_BUCKET = "covers";

type Category = { id: string; name: string; name_ko?: string | null };

export default function ManageNewSpecialEventPage() {
  const router = useRouter();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [groups, setGroups] = React.useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");

  React.useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("categories").select("id, name, name_ko, slug, emoji").order("name"),
      supabase.from("groups").select("id, name").order("name"),
    ]).then(([catRes, grpRes]) => {
      setCategories((catRes.data ?? []) as Category[]);
      setGroups((grpRes.data ?? []) as { id: string; name: string }[]);
    });
  }, []);

  function validateCoverFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type))
      return "Please upload a JPG, PNG, or GIF image.";
    if (file.size > MAX_IMAGE_BYTES) return "Image must be 5MB or smaller.";
    return null;
  }

  async function uploadCover(file: File): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: err } = await supabase.storage.from(COVERS_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (err) return null;
    const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const title = (form.querySelector('[name="title"]') as HTMLInputElement).value.trim();
    const start_time = startTime;
    const end_time = endTime;
    const event_type = (form.querySelector('[name="event_type"]') as HTMLSelectElement).value;
    const event_theme_id = (form.querySelector('[name="event_theme_id"]') as HTMLSelectElement).value;
    const description = (form.querySelector('[name="description"]') as HTMLTextAreaElement).value.trim();
    const address = (form.querySelector('[name="address"]') as HTMLInputElement).value.trim();
    const host_group_id = (form.querySelector('[name="host_group_id"]') as HTMLSelectElement).value || null;

    if (!title || !start_time || !event_theme_id) {
      setError("Title, start time, and theme are required.");
      return;
    }
    if (coverFile) {
      const validation = validateCoverFile(coverFile);
      if (validation) {
        setError(validation);
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();
    const startIso = new Date(start_time).toISOString();
    const endIso = end_time ? new Date(end_time).toISOString() : null;
    let banner_image_url: string | null = null;
    if (coverFile) {
      banner_image_url = await uploadCover(coverFile);
    }

    const privacy = (form.querySelector('[name="privacy"]') as HTMLSelectElement)?.value || "public";
    const { error: insertErr } = await supabase.from("events").insert({
      title,
      start_time: startIso,
      end_time: endIso,
      event_type: event_type || "Regular",
      event_theme_id,
      privacy: privacy === "private" ? "private" : privacy === "exclusive" ? "exclusive" : "public",
      description: description || null,
      address: address || null,
      host_group_id,
      is_boosted: true,
      banner_image_url,
    });

    setSaving(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    router.push("/manage?tab=events");
  }

  return (
    <main className="min-h-screen border-b">
      <div className="container px-4 py-6 max-w-xl">
        <div className="mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/manage?tab=events">← Back to events</Link>
          </Button>
        </div>
        <h1 className="text-xl font-semibold mb-4">Create special event</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Special events are always boosted and appear in featured sections.
        </p>
        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Event title *</Label>
            <Input id="title" name="title" required placeholder="e.g. Community Meetup" className="mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start date & time *</Label>
              <input type="hidden" name="start_time" value={startTime} readOnly aria-hidden />
              <DateTimePicker
                id="start_time"
                value={startTime}
                onChange={setStartTime}
                placeholder="mm/dd/yyyy, --:-- --"
                className="mt-1"
                aria-label="Event start date and time"
              />
            </div>
            <div>
              <Label htmlFor="end_time">End date & time</Label>
              <input type="hidden" name="end_time" value={endTime} readOnly aria-hidden />
              <DateTimePicker
                id="end_time"
                value={endTime}
                onChange={setEndTime}
                placeholder="mm/dd/yyyy, --:-- --"
                className="mt-1"
                aria-label="Event end date and time"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="event_type">Event type</Label>
            <select
              id="event_type"
              name="event_type"
              className="flex h-9 w-full rounded-full border border-input bg-transparent px-4 py-1 text-sm mt-1"
            >
              <option value="Lightning">Lightning</option>
              <option value="Regular">Regular</option>
              <option value="Special">Special</option>
            </select>
          </div>
          <div>
            <Label htmlFor="event_theme_id">Theme / category *</Label>
            <select
              id="event_theme_id"
              name="event_theme_id"
              required
              className="flex h-9 w-full rounded-full border border-input bg-transparent px-4 py-1 text-sm mt-1"
            >
              <option value="">Select</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{getCategoryDisplayName(c.name, c.name_ko ?? undefined)}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="host_group_id">Host group (optional)</Label>
            <select
              id="host_group_id"
              name="host_group_id"
              className="flex h-9 w-full rounded-full border border-input bg-transparent px-4 py-1 text-sm mt-1"
            >
              <option value="">None</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="privacy">Privacy</Label>
            <select
              id="privacy"
              name="privacy"
              className="flex h-9 w-full rounded-full border border-input bg-transparent px-4 py-1 text-sm mt-1"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="exclusive">Exclusive (group members only)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="textarea-rounded-box mt-1"
            />
          </div>
          <div>
            <Label htmlFor="address">Address / location</Label>
            <Input id="address" name="address" placeholder="e.g. Remote or full address" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cover_image">Cover image (optional)</Label>
            <Input
              id="cover_image"
              name="cover_image"
              type="file"
              accept=".jpg,.jpeg,.png,.gif"
              className="mt-1"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, or GIF. Max 5MB. Recommended: 1200×400px.
            </p>
            {coverFile && validateCoverFile(coverFile) && (
              <p className="text-xs text-destructive mt-1">{validateCoverFile(coverFile)}</p>
            )}
          </div>
          <Button type="submit" variant="green" disabled={saving}>
            {saving ? "Creating..." : "Create special event"}
          </Button>
        </form>
      </div>
    </main>
  );
}
