"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  MODERATION_STATUSES,
  formatDateRange,
  isPastEvent,
  type EventRecord,
  type ModerationStatus,
} from "@/lib/events";

const FILTERS: Array<{ label: string; value: ModerationStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Published", value: "published" },
  { label: "Rejected", value: "rejected" },
  { label: "Archived", value: "archived" },
];

export default function EventsTable({ initialEvents }: { initialEvents: EventRecord[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<ModerationStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.moderation_status === filter);
  }, [events, filter]);

  async function updateStatus(event: EventRecord, status: ModerationStatus) {
    setBusyId(event.id);
    const supabase = createClient();

    const patch: Partial<EventRecord> = { moderation_status: status };
    if (status === "published") patch.published_at = new Date().toISOString();
    if (status === "archived") patch.archived_at = new Date().toISOString();

    const { error } = await supabase.from("events").update(patch).eq("id", event.id);
    if (!error) {
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, ...patch } : e))
      );
    }
    setBusyId(null);
  }

  async function deleteEvent(event: EventRecord) {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setBusyId(event.id);
    const supabase = createClient();

    if (event.image_path) {
      await supabase.storage.from("event-images").remove([event.image_path]);
    }
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (!error) {
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
    }
    setBusyId(null);
  }

  return (
    <div className="card">
      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? "active" : ""}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No events in this view.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Title</th>
                <th>Date</th>
                <th>Venue</th>
                <th>City</th>
                <th>Submitter</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.id}>
                  <td>
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.image_url} alt="" className="thumb" />
                    ) : (
                      <div className="thumb" />
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/events/${event.id}`}>{event.title}</Link>
                    {isPastEvent(event) && (
                      <div className="hint" style={{ marginTop: 2 }}>
                        Past event
                      </div>
                    )}
                  </td>
                  <td>{formatDateRange(event.start_date, event.end_date)}</td>
                  <td>{event.venue_name}</td>
                  <td>{event.city}</td>
                  <td>
                    <div>{event.submitter_name}</div>
                    <div className="hint">{event.submitter_email}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${event.moderation_status}`}>
                      {event.moderation_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      {event.moderation_status !== "published" && (
                        <button
                          className="secondary"
                          disabled={busyId === event.id}
                          onClick={() => updateStatus(event, "published")}
                        >
                          Approve
                        </button>
                      )}
                      {event.moderation_status !== "rejected" && (
                        <button
                          className="secondary"
                          disabled={busyId === event.id}
                          onClick={() => updateStatus(event, "rejected")}
                        >
                          Reject
                        </button>
                      )}
                      {event.moderation_status !== "archived" && (
                        <button
                          className="secondary"
                          disabled={busyId === event.id}
                          onClick={() => updateStatus(event, "archived")}
                        >
                          Archive
                        </button>
                      )}
                      <button
                        className="danger"
                        disabled={busyId === event.id}
                        onClick={() => deleteEvent(event)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint" style={{ marginTop: "0.75rem" }}>
        {MODERATION_STATUSES.length} possible statuses: {MODERATION_STATUSES.join(", ")}.
      </p>
    </div>
  );
}
