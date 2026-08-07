import { createServerClient } from "@supabase/ssr";
import Gallery from "./Gallery";
import { PUBLIC_EVENT_COLUMNS, isPastEvent, type PublicEventRecord } from "@/lib/events";

// Public route: uses the anon key directly (no cookies needed) so this page
// can be safely embedded in a cross-origin iframe.
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getPublishedEvents(): Promise<PublicEventRecord[]> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // RLS already restricts anon reads to published, non-past rows (accounting
  // for recurrence), but the past-event check is re-applied here too so the
  // gallery's notion of "past" always matches the single source of truth in
  // lib/events.ts even if the two ever drift.
  const { data, error } = await supabase
    .from("events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("moderation_status", "published")
    .order("start_date", { ascending: true });

  if (error) return [];
  return ((data as unknown as PublicEventRecord[]) || []).filter((event) => !isPastEvent(event));
}

export default async function PublicGalleryPage() {
  const events = await getPublishedEvents();

  return (
    <main className="page-wide">
      <h1>Upcoming Blues Backroads Events</h1>
      <Gallery events={events} />
    </main>
  );
}
