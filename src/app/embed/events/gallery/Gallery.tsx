"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatDateRange,
  formatRecurrence,
  formatTime,
  type EventOccurrence,
  type PublicEventRecord,
} from "@/lib/events";

type View = "grid" | "list";
type Occurrence = EventOccurrence<PublicEventRecord>;

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

// Reports this page's rendered height to the parent window so a Squarespace
// (or any) iframe embed can resize itself instead of clipping content —
// important on mobile where card counts and layout shift the page height.
function useIframeHeightReporter(dependency: unknown) {
  useEffect(() => {
    function postHeight() {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "blues-backroads-gallery-height", height }, "*");
    }

    postHeight();
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.documentElement);
    window.addEventListener("resize", postHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", postHeight);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependency]);
}

export default function Gallery({
  occurrences,
  initialView = "grid",
  showToggle = true,
}: {
  occurrences: Occurrence[];
  initialView?: View;
  showToggle?: boolean;
}) {
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useIframeHeightReporter(`${view}-${occurrences.length}-${selected ? selected.event.id : ""}`);

  if (occurrences.length === 0) {
    return <p className="empty-state">No upcoming events right now. Check back soon!</p>;
  }

  return (
    <div ref={containerRef}>
      {showToggle && (
        <div className="filters" role="group" aria-label="Gallery view">
          <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
            Grid
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            List
          </button>
        </div>
      )}

      {view === "grid" ? (
        <div className="gallery-grid">
          {occurrences.map((occurrence, index) => (
            <button
              key={`${occurrence.event.id}-${occurrence.occurrenceStartDate}-${index}`}
              className="gallery-card"
              onClick={() => setSelected(occurrence)}
            >
              <div className="gallery-date-badge">{formatDateBadge(occurrence.occurrenceStartDate)}</div>
              {occurrence.event.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={occurrence.event.image_url} alt={occurrence.event.title} />
              ) : (
                <div className="thumb" style={{ width: "100%", height: 150 }} />
              )}
              <div className="gallery-card-body">
                <h3>{occurrence.event.title}</h3>
                <div className="gallery-meta">
                  {formatDateRange(occurrence.occurrenceStartDate, occurrence.occurrenceEndDate)}
                </div>
                <div className="gallery-meta">
                  {[occurrence.event.venue_name, occurrence.event.city].filter(Boolean).join(", ")}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="gallery-list">
          {occurrences.map((occurrence, index) => (
            <button
              key={`${occurrence.event.id}-${occurrence.occurrenceStartDate}-${index}`}
              className="gallery-list-item"
              onClick={() => setSelected(occurrence)}
            >
              {occurrence.event.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={occurrence.event.image_url} alt={occurrence.event.title} />
              ) : (
                <div className="thumb" />
              )}
              <div className="gallery-list-item-body">
                <h3>{occurrence.event.title}</h3>
                <div className="gallery-meta">
                  {formatDateRange(occurrence.occurrenceStartDate, occurrence.occurrenceEndDate)}
                </div>
                <div className="gallery-meta">
                  {[occurrence.event.venue_name, occurrence.event.city].filter(Boolean).join(", ")}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">
              ✕
            </button>
            {selected.event.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.event.image_url} alt={selected.event.title} />
            )}
            <div className="modal-body">
              <h2 style={{ marginTop: 0 }}>{selected.event.title}</h2>
              <p>{selected.event.description}</p>
              <p>
                <strong>Date:</strong>{" "}
                {formatDateRange(selected.occurrenceStartDate, selected.occurrenceEndDate)}
                {selected.event.start_time && <> at {formatTime(selected.event.start_time)}</>}
                {selected.event.end_time && <> – {formatTime(selected.event.end_time)}</>}
              </p>
              {formatRecurrence(selected.event) && (
                <p>
                  <strong>Part of a recurring series:</strong> {formatRecurrence(selected.event)}
                </p>
              )}
              {(selected.event.venue_name ||
                selected.event.address ||
                selected.event.city ||
                selected.event.state) && (
                <p>
                  <strong>Venue:</strong>{" "}
                  {[
                    selected.event.venue_name,
                    selected.event.address,
                    selected.event.city,
                    selected.event.state,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {selected.event.venue_phone && (
                <p>
                  <strong>Phone:</strong>{" "}
                  <a href={`tel:${selected.event.venue_phone}`}>{selected.event.venue_phone}</a>
                </p>
              )}
              {selected.event.cost !== null && (
                <p>
                  <strong>Cost:</strong> ${selected.event.cost}
                </p>
              )}
              {selected.event.event_url && (
                <p>
                  <strong>Website:</strong>{" "}
                  <a href={selected.event.event_url} target="_blank" rel="noopener noreferrer">
                    {selected.event.event_url}
                  </a>
                </p>
              )}
              {selected.event.direction_from_memphis && selected.event.direction_from_memphis !== "None" && (
                <p>
                  <strong>Direction from Memphis:</strong> {selected.event.direction_from_memphis}
                </p>
              )}
              {selected.event.miles_from_downtown_memphis !== null && (
                <p>
                  <strong>Miles from Downtown Memphis:</strong>{" "}
                  {selected.event.miles_from_downtown_memphis}
                </p>
              )}
              {(selected.event.venue_name || selected.event.city) && (
                <div className="modal-map">
                  <iframe
                    src={mapEmbedSrc(selected.event)}
                    title={`Map to ${selected.event.venue_name || selected.event.title}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
