"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";

const COVERS_BUCKET = "covers";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif"];

type PhotoRow = { id: string; image_url: string; display_order: number };

export function EventAdminPhotos({ eventId }: { eventId: string }) {
  const [photos, setPhotos] = React.useState<PhotoRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function load() {
    const supabase = createClient();
    supabase
      .from("event_photos")
      .select("id, image_url, display_order")
      .eq("event_id", eventId)
      .order("display_order")
      .then(({ data }) => {
        setPhotos((data ?? []) as PhotoRow[]);
        setLoading(false);
      });
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only when eventId changes
  }, [eventId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please use JPG, PNG, or GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 5MB or smaller.");
      return;
    }
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `events/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(COVERS_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadErr) {
      setError(uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
    const maxOrder = photos.length > 0 ? Math.max(...photos.map((p) => p.display_order)) : -1;
    const { error: insertErr } = await supabase.from("event_photos").insert({
      event_id: eventId,
      image_url: urlData.publicUrl,
      display_order: maxOrder + 1,
    });

    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    load();
  }

  async function handleDelete(photoId: string) {
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("event_photos")
      .delete()
      .eq("id", photoId)
      .eq("event_id", eventId);
    if (!delErr) load();
    else setError(delErr.message);
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("admin.loadingPhotos")}</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("admin.eventPhotos")}</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Label>{t("admin.addPhoto")}</Label>
        <Input
          type="file"
          accept=".jpg,.jpeg,.png,.gif"
          onChange={handleUpload}
          disabled={uploading}
        />
        <p className="text-xs text-muted-foreground">JPG, PNG, or GIF. Max 5MB.</p>
      </div>

      {photos.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.noPhotosYet")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg border">
              <Image
                src={p.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="200px"
              />
              <div className="absolute inset-0 flex items-end justify-end p-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="opacity-90"
                  onClick={() => handleDelete(p.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
