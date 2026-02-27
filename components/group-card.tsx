import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type GroupCardData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  locationCity?: string | null;
  memberCount?: number;
  isPrivate?: boolean;
};

export function GroupCard({
  group,
  className,
  showTypeTag,
}: {
  group: GroupCardData;
  className?: string;
  showTypeTag?: boolean;
}) {
  const membersText =
    group.memberCount != null ? `${group.memberCount.toLocaleString()} members` : null;
  return (
    <Link href={`/groups/${group.id}`} className={cn("block shrink-0 w-[240px]", className)}>
      <div className="rounded-xl overflow-hidden bg-[#f5f5f5] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md flex flex-col">
        <div className="relative aspect-[1.5/1] w-full shrink-0 overflow-hidden rounded-t-xl bg-muted">
          {showTypeTag && (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-primary-green px-2 py-0.5 text-xs font-medium text-white">
              Group
            </span>
          )}
          <Image
            src={group.imageUrl}
            alt=""
            width={240}
            height={160}
            className="object-cover w-full h-full rounded-t-xl"
          />
        </div>
        <div className="p-3 flex flex-col min-h-0">
          <h3 className="font-bold text-primary-green text-sm line-clamp-1">
            {group.name}
          </h3>
          {group.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 overflow-hidden text-ellipsis">
              {group.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-primary-green/90">
            {membersText && (
              <span className="flex items-center gap-1 shrink-0">
                <Users className="h-3.5 w-3 shrink-0" />
                {membersText}
              </span>
            )}
            {group.locationCity && (
              <span className="flex items-center gap-1 shrink-0">
                <MapPin className="h-3.5 w-3 shrink-0" />
                {group.locationCity}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
