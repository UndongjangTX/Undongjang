import { NextRequest } from "next/server";
import { getSearchSuggestions } from "@/lib/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const suggestions = await getSearchSuggestions(q);
  return Response.json(suggestions);
}
