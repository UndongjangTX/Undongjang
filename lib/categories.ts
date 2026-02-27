import { createClient } from "@/lib/supabase/client";

export type Category = {
  id: string;
  name: string;
  name_ko?: string | null;
  slug: string;
  emoji: string;
};

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, name_ko, slug, emoji")
    .order("name");
  if (error || !data) return [];
  return data as Category[];
}
