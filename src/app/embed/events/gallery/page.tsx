import { createServerClient } from "@supabase/ssr";
import Gallery from "./Gallery";
import { PUBLIC_EVENT_COLUMNS, todayInChicago, type PublicEventRecord } from "@/lib/events";

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

  const today = todayInChicago();

  const { data, error } = await supabase
    .from("events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("moderation_status", "published")
    .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
    .order("start_date", { ascending: true });

  if (error) return [];
  return (data as unknown as PublicEventRecord[]) || [];
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
