/**
 * Returns display name for a category. When name_ko is set (from DB), use it; otherwise show the English name.
 * Manual Korean mapping removed — use admin categories tab to set name_ko.
 */
export function getCategoryDisplayName(nameOrSlug: string, nameKo?: string | null): string {
  if (nameKo?.trim()) return nameKo.trim();
  return (nameOrSlug ?? "").trim() || "";
}
