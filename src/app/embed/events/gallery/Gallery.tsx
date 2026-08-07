"use client";

import { useState } from "react";
import {
  formatDateRange,
  formatRecurrence,
  formatTime,
  type PublicEventRecord,
} from "@/lib/events";

function formatDateBadge(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

function mapEmbedSrc(
  event: Pick<PublicEventRecord, "venue_name" | "address" | "city" | "state">
): string {
  const query = [event.venue_name, event.address, event.city, event.state]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export default function Gallery({ events }: { events: PublicEventRecord[] }) {
  const [selected, setSelected] = useState<PublicEventRecord | null>(null);

  if (events.length === 0) {
    return <p className="empty-state">No upcoming events right now. Check back soon!</p>;
  }

  return (
    <>
      <div className="gallery-grid">
        {events.map((event) => (
          <button
            key={event.id}
            className="gallery-card"
            onClick={() => setSelected(event)}
          >
            <div className="gallery-date-badge">{formatDateBadge(event.start_date)}</div>
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.image_url} alt={event.title} />
            ) : (
              <div className="thumb" style={{ width: "100%", height: 150 }} />
            )}
            <div className="gallery-card-body">
              <h3>{event.title}</h3>
              <div className="gallery-meta">
                {formatRecurrence(event) || formatDateRange(event.start_date, event.end_date)}
              </div>
              <div className="gallery-meta">
                {[event.venue_name, event.city].filter(Boolean).join(", ")}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">
              ✕
            </button>
            {selected.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.image_url} alt={selected.title} />
            )}
            <div className="modal-body">
              <h2 style={{ marginTop: 0 }}>{selected.title}</h2>
              <p>{selected.description}</p>
              <p>
                <strong>Date:</strong> {formatDateRange(selected.start_date, selected.end_date)}
                {selected.start_time && <> at {formatTime(selected.start_time)}</>}
                {selected.end_time && <> – {formatTime(selected.end_time)}</>}
              </p>
              {formatRecurrence(selected) && (
                <p>
                  <strong>Repeats:</strong> {formatRecurrence(selected)}
                </p>
              )}
              {(selected.venue_name || selected.address || selected.city || selected.state) && (
                <p>
                  <strong>Venue:</strong>{" "}
                  {[selected.venue_name, selected.address, selected.city, selected.state]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {selected.venue_phone && (
                <p>
                  <strong>Phone:</strong>{" "}
                  <a href={`tel:${selected.venue_phone}`}>{selected.venue_phone}</a>
                </p>
              )}
              {selected.cost !== null && (
                <p>
                  <strong>Cost:</strong> ${selected.cost}
                </p>
              )}
              {selected.event_url && (
                <p>
                  <strong>Website:</strong>{" "}
                  <a href={selected.event_url} target="_blank" rel="noopener noreferrer">
                    {selected.event_url}
                  </a>
                </p>
              )}
              {selected.direction_from_memphis && selected.direction_from_memphis !== "None" && (
                <p>
                  <strong>Direction from Memphis:</strong> {selected.direction_from_memphis}
                </p>
              )}
              {selected.miles_from_downtown_memphis !== null && (
                <p>
                  <strong>Miles from Downtown Memphis:</strong>{" "}
                  {selected.miles_from_downtown_memphis}
                </p>
              )}
              {(selected.venue_name || selected.city) && (
                <div className="modal-map">
                  <iframe
                    src={mapEmbedSrc(selected)}
                    title={`Map to ${selected.venue_name || selected.title}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
