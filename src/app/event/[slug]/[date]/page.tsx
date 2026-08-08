import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import {
  PUBLIC_EVENT_COLUMNS,
  buildGoogleCalendarUrl,
  buildICSContent,
  expandOccurrences,
  formatDateRange,
  formatRecurrence,
  formatTime,
  type PublicEventRecord,
} from "@/lib/events";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function getEventBySlug(slug: string): Promise<PublicEventRecord | null> {
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

  const { data, error } = await supabase
    .from("events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("slug", slug)
    .eq("moderation_status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PublicEventRecord;
}

function mapEmbedSrc(event: PublicEventRecord): string {
  const query = [event.venue_name, event.address, event.city, event.state].filter(Boolean).join(", ");
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function toICSDataUrl(content: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; date: string };
}): Promise<Metadata> {
  const event = await getEventBySlug(params.slug);
  const occurrence = event
    ? expandOccurrences(event).find((o) => o.occurrenceStartDate === params.date)
    : undefined;
  if (!event || !occurrence) {
    return { title: "Event Not Found — Blues Backroads" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const canonical = siteUrl ? `${siteUrl}/event/${event.slug}/${params.date}/` : undefined;
  const description = event.description.slice(0, 200);

  return {
    title: `${event.title} — Blues Backroads`,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: event.title,
      description,
      images: event.image_url ? [event.image_url] : undefined,
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: event.image_url ? [event.image_url] : undefined,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: { slug: string; date: string };
}) {
  const event = await getEventBySlug(params.slug);
  const occurrence = event
    ? expandOccurrences(event).find((o) => o.occurrenceStartDate === params.date)
    : undefined;
  if (!event || !occurrence) {
    notFound();
  }

  const occurrenceStartDate = occurrence.occurrenceStartDate;
  const occurrenceEndDate = occurrence.occurrenceEndDate;

  const calendarInput = {
    title: event.title,
    description: event.description,
    occurrenceStartDate,
    occurrenceEndDate,
    start_time: event.start_time,
    end_time: event.end_time,
    venue_name: event.venue_name,
    address: event.address,
    city: event.city,
    state: event.state,
  };

  const googleCalendarUrl = buildGoogleCalendarUrl(calendarInput);
  const icsDataUrl = toICSDataUrl(buildICSContent(calendarInput));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start_time ? `${occurrenceStartDate}T${event.start_time}` : occurrenceStartDate,
    endDate:
      event.end_time && occurrenceEndDate
        ? `${occurrenceEndDate}T${event.end_time}`
        : event.end_time
          ? `${occurrenceStartDate}T${event.end_time}`
          : undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    image: event.image_url || undefined,
    description: event.description,
    location: {
      "@type": "Place",
      name: event.venue_name || undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address || undefined,
        addressLocality: event.city || undefined,
        addressRegion: event.state || undefined,
      },
    },
    offers:
      event.cost !== null
        ? {
            "@type": "Offer",
            price: event.cost,
            priceCurrency: "USD",
            url: event.event_url || undefined,
          }
        : undefined,
    url: event.event_url || undefined,
  };

  return (
    <main className="page">
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a
        href="https://bluesbackroads.com/events"
        className="bb-explore-hero"
        style={{
          backgroundImage:
            "url(https://images.squarespace-cdn.com/content/v1/6a4e488ced46b83c3154160c/520e1790-118d-4d15-950f-de7c6e826176/people-shopping-booths.png)",
        }}
        aria-label="View all upcoming events"
      >
        <div className="bb-explore-title" aria-label="Upcoming Events">
          <div className="bb-explore-top">UPCOMING</div>
          <div className="bb-explore-script">Events</div>
        </div>
      </a>

      {event.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.image_url}
          alt={event.title}
          style={{ width: "100%", maxHeight: 360, objectFit: "contain", background: "#eee", borderRadius: 10, marginBottom: "1.5rem" }}
        />
      )}

      <h1>{event.title}</h1>
      <p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <p>
          <strong>Date:</strong> {formatDateRange(occurrenceStartDate, occurrenceEndDate)}
          {event.start_time && <> at {formatTime(event.start_time)}</>}
          {event.end_time && <> – {formatTime(event.end_time)}</>}
        </p>
        {formatRecurrence(event) && (
          <p>
            <strong>Part of a recurring series:</strong> {formatRecurrence(event)}
          </p>
        )}
        {(event.venue_name || event.address || event.city || event.state) && (
          <p>
            <strong>Venue:</strong>{" "}
            {[event.venue_name, event.address, event.city, event.state].filter(Boolean).join(", ")}
          </p>
        )}
        {event.venue_phone && (
          <p>
            <strong>Phone:</strong> <a href={`tel:${event.venue_phone}`}>{event.venue_phone}</a>
          </p>
        )}
        {event.cost !== null && (
          <p>
            <strong>Cost:</strong> ${event.cost}
          </p>
        )}
        {event.event_url && (
          <p>
            <strong>Website:</strong>{" "}
            <a href={event.event_url} target="_blank" rel="noopener noreferrer">
              {event.event_url}
            </a>
          </p>
        )}
        {event.direction_from_memphis && event.direction_from_memphis !== "None" && (
          <p>
            <strong>Direction from Memphis:</strong> {event.direction_from_memphis}
          </p>
        )}
        {event.miles_from_downtown_memphis !== null && (
          <p>
            <strong>Miles from Downtown Memphis:</strong> {event.miles_from_downtown_memphis}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <a className="secondary" href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar
          </a>
          <a className="secondary" href={icsDataUrl} download={`${event.slug}.ics`}>
            Download .ics (Apple/Outlook)
          </a>
        </div>

        {(event.venue_name || event.city) && (
          <div className="modal-map" style={{ marginTop: "1.25rem" }}>
            <iframe
              src={mapEmbedSrc(event)}
              title={`Map to ${event.venue_name || event.title}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </main>
  );
}
