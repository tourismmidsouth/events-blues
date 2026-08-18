import { createServerClient } from "@supabase/ssr";
import Gallery from "./Gallery";
import {
  PUBLIC_EVENT_COLUMNS,
  expandOccurrences,
  isPastOccurrence,
  type EventOccurrence,
  type PublicEventRecord,
} from "@/lib/events";

// Public route: uses the anon key directly (no cookies needed) so this page
// can be safely embedded in a cross-origin iframe. Every export below exists
// to guarantee this page is re-fetched fresh on every load rather than
// served from any cache layer — an event that was upcoming an hour ago can
// be past now, and this is the only place "past" is decided for visitors.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function getUpcomingOccurrences(): Promise<EventOccurrence<PublicEventRecord>[]> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );

  // RLS already restricts anon reads to published rows whose series hasn't
  // fully ended, but each occurrence's own past/future status is re-checked
  // here so the gallery's notion of "past" always matches the single source
  // of truth in lib/events.ts even if the two ever drift.
  const { data, error } = await supabase
    .from("events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("moderation_status", "published")
    .order("start_date", { ascending: true });

  if (error) return [];

  const events = (data as unknown as PublicEventRecord[]) || [];
  const occurrences = events.flatMap((event) => expandOccurrences(event));

  return occurrences
    .filter((occurrence) => !isPastOccurrence(occurrence))
    .sort((a, b) => a.occurrenceStartDate.localeCompare(b.occurrenceStartDate));
}

function parseView(value: string | string[] | undefined): "grid" | "list" {
  return value === "list" ? "list" : "grid";
}

function parseBoolean(value: string | string[] | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized !== "0" && normalized !== "false";
}

export default async function PublicGalleryPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const allOccurrences = await getUpcomingOccurrences();

  const limitParam = Array.isArray(searchParams.limit) ? searchParams.limit[0] : searchParams.limit;
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 0) : undefined;
  const occurrences = limit ? allOccurrences.slice(0, limit) : allOccurrences;

  const initialView = parseView(searchParams.view);
  const showToggle = parseBoolean(searchParams.toggle, true);
  const cardLinkUrlParam = Array.isArray(searchParams.cardLinkUrl)
    ? searchParams.cardLinkUrl[0]
    : searchParams.cardLinkUrl;
  const cardLinkUrl = cardLinkUrlParam || undefined;

  return (
    <main className="page-wide page-wide-compact">
      <Gallery
        occurrences={occurrences}
        initialView={initialView}
        showToggle={showToggle}
        cardLinkUrl={cardLinkUrl}
      />
    </main>
  );
}
