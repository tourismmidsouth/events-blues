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

  function exportCsv() {
    const columns: Array<{ header: string; value: (e: EventRecord) => string }> = [
      { header: "Title", value: (e) => e.title },
      { header: "Status", value: (e) => e.moderation_status },
      { header: "Start Date", value: (e) => e.start_date },
      { header: "End Date", value: (e) => e.end_date || "" },
      { header: "Venue", value: (e) => e.venue_name || "" },
      { header: "City", value: (e) => e.city || "" },
      { header: "State", value: (e) => e.state || "" },
      { header: "Submitter Name", value: (e) => e.submitter_name },
      { header: "Submitter Email", value: (e) => e.submitter_email },
      { header: "Event URL", value: (e) => e.event_url || "" },
      { header: "Submitted At", value: (e) => e.submitted_at || "" },
      { header: "Published At", value: (e) => e.published_at || "" },
    ];

    function csvEscape(value: string) {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    const rows = [
      columns.map((c) => csvEscape(c.header)).join(","),
      ...events.map((event) => columns.map((c) => csvEscape(c.value(event))).join(",")),
    ];
    const csv = rows.join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `event-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <div className="filters" style={{ justifyContent: "space-between", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
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
        <button className="secondary" onClick={exportCsv}>
          Export All to CSV
        </button>
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
