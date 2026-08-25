"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  MODERATION_STATUSES,
  expandOccurrences,
  formatDateRange,
  isPastEvent,
  isPastOccurrence,
  type EventRecord,
  type ModerationStatus,
} from "@/lib/events";

// One past occurrence of an event — for a recurring series still in
// progress, this lets each already-happened date show up individually
// instead of the whole (still-active) series being hidden.
type PastOccurrenceRow = {
  event: EventRecord;
  occurrenceStartDate: string;
  occurrenceEndDate: string | null;
};

const FILTERS: Array<{ label: string; value: ModerationStatus | "all" | "past" }> = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Published", value: "published" },
  { label: "Rejected", value: "rejected" },
  { label: "Archived", value: "archived" },
  { label: "Past Events", value: "past" },
];

export default function EventsTable({ initialEvents }: { initialEvents: EventRecord[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<ModerationStatus | "all" | "past">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const notPast = events.filter((e) => !isPastEvent(e));
    if (filter === "all") return notPast;
    return notPast.filter((e) => e.moderation_status === filter);
  }, [events, filter]);

  const pastOccurrences = useMemo<PastOccurrenceRow[]>(() => {
    if (filter !== "past") return [];
    const rows = events.flatMap((event) =>
      expandOccurrences(event)
        .filter((occurrence) => isPastOccurrence(occurrence))
        .map((occurrence) => ({
          event,
          occurrenceStartDate: occurrence.occurrenceStartDate,
          occurrenceEndDate: occurrence.occurrenceEndDate,
        }))
    );
    return rows.sort((a, b) => b.occurrenceStartDate.localeCompare(a.occurrenceStartDate));
  }, [events, filter]);

  async function updateStatus(event: EventRecord, status: ModerationStatus) {
    setBusyId(event.id);
    const supabase = createClient();

    const wasPublished = event.moderation_status === "published";
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

    if (!error && status === "published" && !wasPublished && !event.approval_email_sent_at) {
      const shouldNotify = window.confirm(
        'This event is now live. Send "your event is live" email to the organizer now?\n\nOK = send it now\nCancel = not yet, I want to make changes first'
      );
      if (shouldNotify) {
        await notifyOrganizer(event.id);
      }
    }
  }

  async function notifyOrganizer(eventId: string) {
    setBusyId(eventId);
    try {
      const res = await fetch("/api/events/notify-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success || data.alreadySent) {
          const sentAt = new Date().toISOString();
          setEvents((prev) =>
            prev.map((e) => (e.id === eventId ? { ...e, approval_email_sent_at: sentAt } : e))
          );
        }
      } else {
        console.error("notify-approved request failed:", res.status);
      }
    } catch (err) {
      console.error("notify-approved request failed:", err);
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

      {filter === "past" ? (
        pastOccurrences.length === 0 ? (
          <p className="empty-state">No past events.</p>
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
                {pastOccurrences.map(({ event, occurrenceStartDate, occurrenceEndDate }) => (
                  <tr key={`${event.id}-${occurrenceStartDate}`}>
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
                    </td>
                    <td>{formatDateRange(occurrenceStartDate, occurrenceEndDate)}</td>
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
        )
      ) : filtered.length === 0 ? (
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
                      {event.moderation_status === "published" &&
                        (event.approval_email_sent_at ? (
                          <span className="hint" title={new Date(event.approval_email_sent_at).toLocaleString()}>
                            Organizer emailed
                          </span>
                        ) : (
                          <button
                            className="secondary"
                            disabled={busyId === event.id}
                            onClick={() => notifyOrganizer(event.id)}
                          >
                            Notify Organizer
                          </button>
                        ))}
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
