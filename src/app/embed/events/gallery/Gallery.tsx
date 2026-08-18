"use client";

import { useEffect, useState } from "react";
import {
  buildGoogleCalendarUrl,
  buildICSContent,
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

function toICSDataUrl(content: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}

// Reports this page's rendered height to the parent window so a Squarespace
// (or any) iframe embed can resize itself to fit the content exactly,
// instead of showing its own internal scrollbar — the embed should always
// grow/shrink with its content, never scroll within itself.
function useIframeHeightReporter(dependency: unknown) {
  useEffect(() => {
    function postHeight() {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "blues-backroads-gallery-height", height }, "*");
    }

    postHeight();
    const raf = requestAnimationFrame(postHeight);
    const resizeObserver = new ResizeObserver(postHeight);
    resizeObserver.observe(document.documentElement);
    const mutationObserver = new MutationObserver(postHeight);
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("load", postHeight);
    window.addEventListener("resize", postHeight);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("load", postHeight);
      window.removeEventListener("resize", postHeight);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependency]);
}

export default function Gallery({
  occurrences,
  initialView = "grid",
  showToggle = true,
  cardLinkUrl,
}: {
  occurrences: Occurrence[];
  initialView?: View;
  showToggle?: boolean;
  cardLinkUrl?: string;
}) {
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<Occurrence | null>(null);

  useIframeHeightReporter(`${view}-${occurrences.length}-${selected ? selected.event.id : ""}`);

  function openOccurrence(occurrence: Occurrence) {
    setSelected(occurrence);
    // Bring the user to the top so the modal is visible with no scrolling —
    // both within the iframe itself and, via postMessage, the parent page
    // it's embedded in (the listener script documented in the README).
    // Deferred a frame so the modal has rendered and the iframe has already
    // reported its updated height before the parent scrolls, otherwise the
    // parent scrolls to a position based on the pre-modal (shorter) height.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      window.parent.postMessage({ type: "blues-backroads-scroll-top" }, "*");
    });
  }

  if (occurrences.length === 0) {
    return <p className="empty-state">No upcoming events right now. Check back soon!</p>;
  }

  const CardImage = ({ occurrence }: { occurrence: Occurrence }) =>
    occurrence.event.image_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={occurrence.event.image_url} alt={occurrence.event.title} />
    ) : (
      <div className="thumb" style={{ width: "100%", height: 150 }} />
    );

  return (
    <div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
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

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", margin: "1rem 0" }}>
                <a
                  className="secondary"
                  href={buildGoogleCalendarUrl({
                    title: selected.event.title,
                    description: selected.event.description,
                    occurrenceStartDate: selected.occurrenceStartDate,
                    occurrenceEndDate: selected.occurrenceEndDate,
                    start_time: selected.event.start_time,
                    end_time: selected.event.end_time,
                    venue_name: selected.event.venue_name,
                    address: selected.event.address,
                    city: selected.event.city,
                    state: selected.event.state,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Add to Google Calendar
                </a>
                <a
                  className="secondary"
                  href={toICSDataUrl(
                    buildICSContent({
                      title: selected.event.title,
                      description: selected.event.description,
                      occurrenceStartDate: selected.occurrenceStartDate,
                      occurrenceEndDate: selected.occurrenceEndDate,
                      start_time: selected.event.start_time,
                      end_time: selected.event.end_time,
                      venue_name: selected.event.venue_name,
                      address: selected.event.address,
                      city: selected.event.city,
                      state: selected.event.state,
                    })
                  )}
                  download={`${selected.event.slug || "event"}.ics`}
                >
                  Download .ics
                </a>
                {selected.event.slug && (
                  <a
                    className="secondary"
                    href={`/event/${selected.event.slug}/${selected.occurrenceStartDate}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Full Page
                  </a>
                )}
              </div>

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
          {occurrences.map((occurrence, index) => {
            const key = `${occurrence.event.id}-${occurrence.occurrenceStartDate}-${index}`;
            const cardBody = (
              <>
                <div className="gallery-date-badge">{formatDateBadge(occurrence.occurrenceStartDate)}</div>
                <CardImage occurrence={occurrence} />
                <div className="gallery-card-body">
                  <h3>{occurrence.event.title}</h3>
                  <div className="gallery-meta">
                    {formatDateRange(occurrence.occurrenceStartDate, occurrence.occurrenceEndDate)}
                  </div>
                  <div className="gallery-meta">
                    {[occurrence.event.venue_name, occurrence.event.city].filter(Boolean).join(", ")}
                  </div>
                </div>
              </>
            );
            return cardLinkUrl ? (
              <a key={key} className="gallery-card" href={cardLinkUrl} target="_blank" rel="noopener noreferrer">
                {cardBody}
              </a>
            ) : (
              <button key={key} className="gallery-card" onClick={() => openOccurrence(occurrence)}>
                {cardBody}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="gallery-list">
          {occurrences.map((occurrence, index) => {
            const key = `${occurrence.event.id}-${occurrence.occurrenceStartDate}-${index}`;
            const itemBody = (
              <>
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
              </>
            );
            return cardLinkUrl ? (
              <a
                key={key}
                className="gallery-list-item"
                href={cardLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {itemBody}
              </a>
            ) : (
              <button key={key} className="gallery-list-item" onClick={() => openOccurrence(occurrence)}>
                {itemBody}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
