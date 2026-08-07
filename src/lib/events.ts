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

// Public-safe projection: never includes submitter_name or submitter_email.
export type PublicEventRecord = Omit<
  EventRecord,
  "submitter_name" | "submitter_email"
>;

export const PUBLIC_EVENT_COLUMNS = [
  "id",
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
