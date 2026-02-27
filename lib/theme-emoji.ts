const DEFAULT_EMOJI = "📅";

/**
 * Returns the theme emoji for a category by exact name match from the categories list (from DB).
 * Use this when you have only a category name (e.g. from an event) and a list of categories.
 */
export function getThemeEmoji(
  categoryName: string | null | undefined,
  categories: { name: string; emoji?: string | null }[] = []
): string {
  if (!categoryName?.trim()) return DEFAULT_EMOJI;
  const cat = categories.find((c) => c.name === categoryName.trim());
  return (cat?.emoji?.trim() as string) || DEFAULT_EMOJI;
}

/** Emoji for the "All" / all categories filter in nav. */
export const ALL_CATEGORIES_EMOJI = "📋";
