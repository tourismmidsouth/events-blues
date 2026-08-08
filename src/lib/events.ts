export const DIRECTION_OPTIONS = ["None", "North", "East", "South", "West"] as const;
export type Direction = (typeof DIRECTION_OPTIONS)[number];

export const MODERATION_STATUSES = [
  "submitted",
  "published",
  "rejected",
  "archived",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const RECURRENCE_FREQUENCIES = ["none", "daily", "weekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const EVENT_TIMEZONE = "America/Chicago";

export interface EventRecord {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  image_url: string | null;
  image_path: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  venue_phone: string | null;
  event_url: string | null;
  cost: number | null;
  direction_from_memphis: Direction | null;
  miles_from_downtown_memphis: number | null;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_end_date: string | null;
  submitter_name: string;
  submitter_email: string;
  image_rights_confirmed: boolean;
  moderation_status: ModerationStatus;
  submitted_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  updated_at: string | null;
}

// Turns a title into a URL-safe slug: lowercase, alphanumerics and hyphens
// only, no leading/trailing/repeated hyphens.
// Accepts bare domains like "facebook.com" or "www.facebook.com" in addition
// to full URLs — prepends https:// when no scheme is present. Returns null
// if the value still isn't a usable URL.
export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "event";
}

// Public-safe projection: never includes submitter_name or submitter_email.
export type PublicEventRecord = Omit<
  EventRecord,
  "submitter_name" | "submitter_email"
>;

export const PUBLIC_EVENT_COLUMNS = [
  "id",
  "slug",
  "title",
  "description",
  "image_url",
  "image_path",
  "start_date",
  "start_time",
  "end_date",
  "end_time",
  "venue_name",
  "address",
  "city",
  "state",
  "venue_phone",
  "event_url",
  "cost",
  "direction_from_memphis",
  "miles_from_downtown_memphis",
  "recurrence_frequency",
  "recurrence_end_date",
  "image_rights_confirmed",
  "moderation_status",
  "submitted_at",
  "published_at",
  "archived_at",
  "updated_at",
].join(",");

function isRecurring(
  event: Pick<EventRecord, "recurrence_frequency">
): boolean {
  return !!event.recurrence_frequency && event.recurrence_frequency !== "none";
}

// An event is "past" once its effective end date is before today, evaluated
// in the America/Chicago timezone. For a recurring event, the effective end
// date is the recurrence end date (the series isn't over just because its
// first occurrence passed); otherwise it's end_date, falling back to
// start_date.
export function isPastEvent(
  event: Pick<
    EventRecord,
    "start_date" | "end_date" | "recurrence_frequency" | "recurrence_end_date"
  >
): boolean {
  const today = todayInChicago();

  if (isRecurring(event)) {
    // No recurrence end date set means the series is treated as ongoing.
    if (!event.recurrence_end_date) return false;
    return event.recurrence_end_date < today;
  }

  const effectiveDate = event.end_date || event.start_date;
  return effectiveDate < today;
}

export function todayInChicago(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()); // en-CA formats as YYYY-MM-DD
}

export function formatDateRange(startDate: string, endDate: string | null): string {
  const format = (d: string) => {
    const [year, month, day] = d.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!endDate || endDate === startDate) {
    return format(startDate);
  }
  return `${format(startDate)} – ${format(endDate)}`;
}

export function formatTime(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// A single occurrence of an event, resolved to a concrete calendar date.
// Non-recurring events produce exactly one occurrence (their own
// start/end date); recurring events are expanded into one occurrence per
// repetition so each date gets its own gallery card.
export interface EventOccurrence<
  T extends Pick<EventRecord, "start_date" | "end_date" | "recurrence_frequency" | "recurrence_end_date"> = EventRecord
> {
  event: T;
  occurrenceStartDate: string;
  occurrenceEndDate: string | null;
}

const MAX_OCCURRENCES = 500;

function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stepDate(date: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(date);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

// Expands an event into one occurrence per calendar date it actually
// happens on. For a recurring event, each occurrence keeps the same
// start/end time and the same span length (in days) as the original
// start_date/end_date, shifted to that occurrence's date.
export function expandOccurrences<
  T extends Pick<EventRecord, "start_date" | "end_date" | "recurrence_frequency" | "recurrence_end_date">
>(event: T): EventOccurrence<T>[] {
  if (!isRecurring(event) || !event.recurrence_end_date) {
    return [
      {
        event,
        occurrenceStartDate: event.start_date,
        occurrenceEndDate: event.end_date,
      },
    ];
  }

  const spanDays =
    event.end_date && event.end_date !== event.start_date
      ? Math.round(
          (parseDateOnly(event.end_date).getTime() - parseDateOnly(event.start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  const endBound = parseDateOnly(event.recurrence_end_date);
  const occurrences: EventOccurrence<T>[] = [];
  let cursor = parseDateOnly(event.start_date);

  while (cursor <= endBound && occurrences.length < MAX_OCCURRENCES) {
    const occurrenceStart = formatDateOnly(cursor);
    let occurrenceEnd: string | null = null;
    if (spanDays > 0) {
      const endCursor = new Date(cursor);
      endCursor.setDate(endCursor.getDate() + spanDays);
      occurrenceEnd = formatDateOnly(endCursor);
    }
    occurrences.push({ event, occurrenceStartDate: occurrenceStart, occurrenceEndDate: occurrenceEnd });
    cursor = stepDate(cursor, event.recurrence_frequency as RecurrenceFrequency);
  }

  return occurrences;
}

// True if dateStr is a date this event actually occurs on — either its
// single start_date, or (for a recurring event) one of the dates its
// recurrence pattern lands on. Used to validate a /event/[slug]/[date] URL
// rather than trusting the date segment blindly.
export function isValidOccurrenceDate(
  event: Pick<EventRecord, "start_date" | "end_date" | "recurrence_frequency" | "recurrence_end_date">,
  dateStr: string
): boolean {
  return expandOccurrences(event).some((occurrence) => occurrence.occurrenceStartDate === dateStr);
}

// True once an individual occurrence's effective date (occurrenceEndDate,
// falling back to occurrenceStartDate) is before today in America/Chicago.
export function isPastOccurrence(occurrence: Pick<EventOccurrence, "occurrenceStartDate" | "occurrenceEndDate">): boolean {
  const today = todayInChicago();
  const effectiveDate = occurrence.occurrenceEndDate || occurrence.occurrenceStartDate;
  return effectiveDate < today;
}

interface CalendarEventInput {
  title: string;
  description: string;
  occurrenceStartDate: string;
  occurrenceEndDate: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

function calendarLocation(input: CalendarEventInput): string {
  return [input.venue_name, input.address, input.city, input.state].filter(Boolean).join(", ");
}

function compactDateTime(dateStr: string, timeStr: string): string {
  return `${dateStr.replace(/-/g, "")}T${timeStr.replace(":", "")}00`;
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateOnly(date);
}

function addHoursToTimeStr(timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

// Google Calendar "quick add" link. Uses floating local time + ctz so no
// UTC conversion/timezone library is needed.
export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", input.title);
  if (input.description) params.set("details", input.description);
  const location = calendarLocation(input);
  if (location) params.set("location", location);
  params.set("ctz", EVENT_TIMEZONE);

  if (input.start_time) {
    const endDate = input.occurrenceEndDate || input.occurrenceStartDate;
    const endTime = input.end_time || addHoursToTimeStr(input.start_time, 2);
    params.set(
      "dates",
      `${compactDateTime(input.occurrenceStartDate, input.start_time)}/${compactDateTime(endDate, endTime)}`
    );
  } else {
    const endDate = addDaysToDateStr(input.occurrenceEndDate || input.occurrenceStartDate, 1);
    params.set(
      "dates",
      `${input.occurrenceStartDate.replace(/-/g, "")}/${endDate.replace(/-/g, "")}`
    );
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Standard America/Chicago VTIMEZONE block (US DST rules since 2007),
// needed so downloaded .ics files show the correct local time in any
// calendar app regardless of the importing user's own timezone.
const CENTRAL_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:America/Chicago
BEGIN:DAYLIGHT
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
TZNAME:CDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0500
TZOFFSETTO:-0600
TZNAME:CST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE`;

function escapeICSText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Builds a downloadable .ics file's contents for a single event occurrence.
export function buildICSContent(input: CalendarEventInput): string {
  const location = calendarLocation(input);
  const uid = `${input.occurrenceStartDate}-${slugify(input.title)}@bluesbackroads`;
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate()
  ).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(
    2,
    "0"
  )}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

  let dtLines: string;
  if (input.start_time) {
    const endDate = input.occurrenceEndDate || input.occurrenceStartDate;
    const endTime = input.end_time || addHoursToTimeStr(input.start_time, 2);
    dtLines = [
      `DTSTART;TZID=${EVENT_TIMEZONE}:${compactDateTime(input.occurrenceStartDate, input.start_time)}`,
      `DTEND;TZID=${EVENT_TIMEZONE}:${compactDateTime(endDate, endTime)}`,
    ].join("\r\n");
  } else {
    const endDate = addDaysToDateStr(input.occurrenceEndDate || input.occurrenceStartDate, 1);
    dtLines = [
      `DTSTART;VALUE=DATE:${input.occurrenceStartDate.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${endDate.replace(/-/g, "")}`,
    ].join("\r\n");
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blues Backroads//Events//EN",
    "CALSCALE:GREGORIAN",
    CENTRAL_VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    dtLines,
    `SUMMARY:${escapeICSText(input.title)}`,
    input.description ? `DESCRIPTION:${escapeICSText(input.description)}` : null,
    location ? `LOCATION:${escapeICSText(location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// Human-readable recurrence description, e.g. "Weekly through Dec 20, 2026".
export function formatRecurrence(
  event: Pick<EventRecord, "recurrence_frequency" | "recurrence_end_date">
): string | null {
  if (!isRecurring(event)) return null;

  const frequencyLabel: Record<Exclude<RecurrenceFrequency, "none">, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  const label = frequencyLabel[event.recurrence_frequency as Exclude<RecurrenceFrequency, "none">];

  if (!event.recurrence_end_date) return label;

  const [year, month, day] = event.recurrence_end_date.split("-").map(Number);
  const endDate = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${label} through ${endDate}`;
}
