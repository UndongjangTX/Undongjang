"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

type Suggestion = { label: string; type: "event" | "group"; id: string };

export function SearchBar({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data: Suggestion[]) => setSuggestions(Array.isArray(data) ? data : []))
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  function runSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(value);
    setIsOpen(false);
  }

  const showDropdown = isOpen && (value.trim().length >= 2 || suggestions.length > 0);

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-xl", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-green shrink-0" />
        <Input
          type="search"
          placeholder={t("search.barPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="h-10 pl-9 pr-4 rounded-full border-2 border-primary-green bg-white text-foreground placeholder:text-[#555555] focus:bg-white focus-visible:ring-2 focus-visible:ring-primary-green focus-visible:ring-offset-0"
          autoComplete="off"
        />
      </form>
      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
          role="listbox"
        >
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
            {value.trim().length >= 2 ? (loading ? "Searching..." : "Suggestions") : "Type to search"}
          </div>
          {suggestions.length === 0 && !loading && value.trim().length >= 2 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches. Try another term.</div>
          )}
          {suggestions.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              role="option"
              aria-selected={value === item.label}
              className="flex w-full items-center gap-2 rounded-full px-4 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                setValue(item.label);
                setIsOpen(false);
                const path = item.type === "event" ? `/events/${item.id}` : `/groups/${item.id}`;
                router.push(path);
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {item.label}
              <span className="ml-1 text-xs text-muted-foreground">({item.type})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
