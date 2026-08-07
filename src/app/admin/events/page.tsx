import { createClient } from "@/lib/supabase/server";
import EventsTable from "./EventsTable";
import type { EventRecord } from "@/lib/events";

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: false });

  return (
    <main className="page-wide">
      <div className="top-bar">
        <div>
          <h1>Event Submissions</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Review, edit, and publish submitted events.
          </p>
        </div>
      </div>
      {error && <p className="error-text">Failed to load events: {error.message}</p>}
      <EventsTable initialEvents={(data as EventRecord[]) || []} />
    </main>
  );
}
