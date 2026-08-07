"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DIRECTION_OPTIONS,
  MODERATION_STATUSES,
  RECURRENCE_FREQUENCIES,
  type EventRecord,
} from "@/lib/events";

export default function EditEventForm({ event }: { event: EventRecord }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: event.title,
    description: event.description,
    start_date: event.start_date,
    start_time: event.start_time || "",
    end_date: event.end_date || "",
    end_time: event.end_time || "",
    venue_name: event.venue_name || "",
    address: event.address || "",
    city: event.city || "",
    state: event.state || "",
    venue_phone: event.venue_phone || "",
    event_url: event.event_url || "",
    cost: event.cost?.toString() || "",
    direction_from_memphis: event.direction_from_memphis || "None",
    miles_from_downtown_memphis: event.miles_from_downtown_memphis?.toString() || "",
    recurrence_frequency: event.recurrence_frequency || "none",
    recurrence_end_date: event.recurrence_end_date || "",
    moderation_status: event.moderation_status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);
    setSavedMessage(null);
    setSaving(true);

    const supabase = createClient();
    const patch: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      start_date: form.start_date,
      start_time: form.start_time || null,
      end_date: form.end_date || null,
      end_time: form.end_time || null,
      venue_name: form.venue_name,
      address: form.address || null,
      city: form.city,
      state: form.state,
      venue_phone: form.venue_phone || null,
      event_url: form.event_url,
      cost: form.cost ? Number(form.cost) : null,
      direction_from_memphis: form.direction_from_memphis,
      miles_from_downtown_memphis: form.miles_from_downtown_memphis
        ? Number(form.miles_from_downtown_memphis)
        : null,
      recurrence_frequency: form.recurrence_frequency,
      recurrence_end_date: form.recurrence_frequency !== "none" ? form.recurrence_end_date || null : null,
      moderation_status: form.moderation_status,
    };

    if (form.moderation_status === "published" && event.moderation_status !== "published") {
      patch.published_at = new Date().toISOString();
    }
    if (form.moderation_status === "archived" && event.moderation_status !== "archived") {
      patch.archived_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase.from("events").update(patch).eq("id", event.id);

    if (updateError) {
      setError("Failed to save changes.");
      setSaving(false);
      return;
    }

    setSavedMessage("Changes saved.");
    setSaving(false);
    router.refresh();
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">Event Title</label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
        />
      </div>

      {event.image_url && (
        <div className="field">
          <label>Current Image</label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.image_url} alt="" style={{ maxWidth: 220, borderRadius: 8 }} />
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="start_date">Start Date</label>
          <input
            id="start_date"
            type="date"
            value={form.start_date}
            onChange={(e) => update("start_date", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="end_date">End Date</label>
          <input
            id="end_date"
            type="date"
            value={form.end_date}
            onChange={(e) => update("end_date", e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="start_time">Start Time</label>
          <input
            id="start_time"
            type="time"
            value={form.start_time}
            onChange={(e) => update("start_time", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="end_time">End Time</label>
          <input
            id="end_time"
            type="time"
            value={form.end_time}
            onChange={(e) => update("end_time", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="recurrence_frequency">Repeats</label>
        <select
          id="recurrence_frequency"
          value={form.recurrence_frequency}
          onChange={(e) => update("recurrence_frequency", e.target.value as typeof form.recurrence_frequency)}
        >
          {RECURRENCE_FREQUENCIES.map((option) => (
            <option key={option} value={option}>
              {option === "none" ? "Does not repeat" : option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {form.recurrence_frequency !== "none" && (
        <div className="field">
          <label htmlFor="recurrence_end_date">Repeats Until</label>
          <input
            id="recurrence_end_date"
            type="date"
            value={form.recurrence_end_date}
            onChange={(e) => update("recurrence_end_date", e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="venue_name">Venue Name</label>
        <input
          id="venue_name"
          value={form.venue_name}
          onChange={(e) => update("venue_name", e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="address">Street Address</label>
        <input
          id="address"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="state">State</label>
          <input id="state" value={form.state} onChange={(e) => update("state", e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="venue_phone">Venue Phone</label>
        <input
          id="venue_phone"
          type="tel"
          value={form.venue_phone}
          onChange={(e) => update("venue_phone", e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="event_url">Event Website</label>
        <input
          id="event_url"
          type="url"
          value={form.event_url}
          onChange={(e) => update("event_url", e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="cost">Cost</label>
        <input id="cost" type="number" step="0.01" value={form.cost} onChange={(e) => update("cost", e.target.value)} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="direction_from_memphis">Direction from Memphis</label>
          <select
            id="direction_from_memphis"
            value={form.direction_from_memphis}
            onChange={(e) => update("direction_from_memphis", e.target.value as typeof form.direction_from_memphis)}
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="miles_from_downtown_memphis">Miles from Downtown Memphis</label>
          <input
            id="miles_from_downtown_memphis"
            type="number"
            step="0.1"
            value={form.miles_from_downtown_memphis}
            onChange={(e) => update("miles_from_downtown_memphis", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="moderation_status">Status</label>
        <select
          id="moderation_status"
          value={form.moderation_status}
          onChange={(e) => update("moderation_status", e.target.value as typeof form.moderation_status)}
        >
          {MODERATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ background: "#faf8f5" }}>
        <strong>Submitter Info</strong>
        <p className="hint" style={{ margin: "0.4rem 0 0" }}>
          {event.submitter_name} — {event.submitter_email}
        </p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {savedMessage && <p style={{ color: "var(--color-success)" }}>{savedMessage}</p>}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" className="secondary" onClick={() => router.push("/admin/events")}>
          Back to Dashboard
        </button>
      </div>
    </form>
  );
}
