"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop";

export type ProfileItem = { user_id: string; full_name: string | null; avatar_url: string | null };

export function ProfileListSection({
  title,
  count,
  profiles,
  countLabel = "members",
}: {
  title: string;
  count: number;
  profiles: ProfileItem[];
  countLabel?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? profiles : profiles.slice(0, 10);
  const hasMore = profiles.length > 10;

  return (
    <section>
      <h2 className="text-lg font-semibold md:text-xl">
        {title}
        {count > 0 && (
          <span className="ml-2 font-normal text-muted-foreground">
            ({count} {countLabel})
          </span>
        )}
      </h2>
      <ul className="mt-3 space-y-2">
        {visible.map((p) => (
          <li key={p.user_id} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted">
              <Image
                src={p.avatar_url || DEFAULT_AVATAR}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-sm font-medium text-foreground">
              {p.full_name || "Someone"}
            </span>
          </li>
        ))}
      </ul>
      {hasMore && !expanded && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 text-primary-green hover:text-primary-green/90"
          onClick={() => setExpanded(true)}
        >
          See all ({profiles.length})
        </Button>
      )}
      {hasMore && expanded && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground"
          onClick={() => setExpanded(false)}
        >
          Show less
        </Button>
      )}
    </section>
  );
}
