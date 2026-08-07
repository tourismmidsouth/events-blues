"use client";

import { useRef, useState } from "react";
import { DIRECTION_OPTIONS, RECURRENCE_FREQUENCIES } from "@/lib/events";

type FormState = {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  recurrence_frequency: (typeof RECURRENCE_FREQUENCIES)[number];
  recurrence_end_date: string;
  venue_name: string;
  address: string;
  city: string;
  state: string;
  venue_phone: string;
  event_url: string;
  cost: string;
  direction_from_memphis: (typeof DIRECTION_OPTIONS)[number];
  miles_from_downtown_memphis: string;
  submitter_name: string;
  submitter_email: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  recurrence_frequency: "none",
  recurrence_end_date: "",
  venue_name: "",
  address: "",
  city: "",
  state: "",
  venue_phone: "",
  event_url: "",
  cost: "",
  direction_from_memphis: "None",
  miles_from_downtown_memphis: "",
  submitter_name: "",
  submitter_email: "",
};

interface ExtractedEventDetails {
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  venue_phone: string | null;
  event_url: string | null;
  cost: number | null;
  direction_from_memphis: string | null;
  recurrence_frequency: string | null;
  recurrence_end_date: string | null;
}

export default function SubmitEventForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageRightsConfirmed, setImageRightsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setExtractNotice(null);
    if (!file) return;

    setExtracting(true);
    try {
      const imageFormData = new FormData();
      imageFormData.set("image", file);
      const response = await fetch("/api/extract-event-details", {
        method: "POST",
        body: imageFormData,
      });

      if (!response.ok) {
        if (response.status !== 501) {
          setExtractNotice(
            "Couldn't read details from that image automatically — no problem, just fill in the form below."
          );
        }
        return;
      }

      const { result } = (await response.json()) as { result: ExtractedEventDetails };

      setForm((prev) => ({
        ...prev,
        title: result.title || prev.title,
        description: result.description || prev.description,
        start_date: result.start_date || prev.start_date,
        end_date: result.end_date || prev.end_date,
        start_time: result.start_time || prev.start_time,
        end_time: result.end_time || prev.end_time,
        venue_name: result.venue_name || prev.venue_name,
        address: result.address || prev.address,
        city: result.city || prev.city,
        state: result.state || prev.state,
        venue_phone: result.venue_phone || prev.venue_phone,
        event_url: result.event_url || prev.event_url,
        cost: result.cost !== null && result.cost !== undefined ? String(result.cost) : prev.cost,
        direction_from_memphis: DIRECTION_OPTIONS.includes(
          result.direction_from_memphis as (typeof DIRECTION_OPTIONS)[number]
        )
          ? (result.direction_from_memphis as (typeof DIRECTION_OPTIONS)[number])
          : prev.direction_from_memphis,
        recurrence_frequency: RECURRENCE_FREQUENCIES.includes(
          result.recurrence_frequency as (typeof RECURRENCE_FREQUENCIES)[number]
        )
          ? (result.recurrence_frequency as (typeof RECURRENCE_FREQUENCIES)[number])
          : prev.recurrence_frequency,
        recurrence_end_date: result.recurrence_end_date || prev.recurrence_end_date,
      }));

      setExtractNotice(
        "We pre-filled the form from your photo — please double-check everything below before submitting."
      );
    } catch {
      setExtractNotice(
        "Couldn't read details from that image automatically — no problem, just fill in the form below."
      );
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!imageFile) {
      setError("Event image is required.");
      return;
    }

    const formData = new FormData();
    formData.set("image", imageFile);
    Object.entries(form).forEach(([key, value]) => formData.set(key, value));
    formData.set("image_rights_confirmed", imageRightsConfirmed ? "true" : "false");

    setSubmitting(true);
    try {
      const response = await fetch("/api/submit-event", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="success-box">
        Thank you! Your event has been submitted for review.
      </div>
    );
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="image">Event Image *</label>
        <span className="hint">
          JPG, PNG, or WebP. Max 10 MB. Upload a flyer first and we&apos;ll try to
          pre-fill the form for you.
        </span>
        <input
          ref={fileInputRef}
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
        />
        {extracting && <span className="hint">Reading flyer with AI…</span>}
        {!extracting && extractNotice && <span className="hint">{extractNotice}</span>}
      </div>

      <div className="field">
        <label htmlFor="title">Event Title *</label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="description">Event Description *</label>
        <textarea
          id="description"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="start_date">Start Date *</label>
          <input
            id="start_date"
            type="date"
            value={form.start_date}
            onChange={(e) => update("start_date", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="end_date">
            End Date <span className="hint">(optional)</span>
          </label>
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
          <label htmlFor="start_time">
            Start Time <span className="hint">(optional, Central time)</span>
          </label>
          <input
            id="start_time"
            type="time"
            value={form.start_time}
            onChange={(e) => update("start_time", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="end_time">
            End Time <span className="hint">(optional, Central time)</span>
          </label>
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
          onChange={(e) =>
            update("recurrence_frequency", e.target.value as FormState["recurrence_frequency"])
          }
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
          <label htmlFor="recurrence_end_date">Repeats Until *</label>
          <span className="hint">Last date this event occurs.</span>
          <input
            id="recurrence_end_date"
            type="date"
            value={form.recurrence_end_date}
            onChange={(e) => update("recurrence_end_date", e.target.value)}
            required
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="venue_name">Venue Name *</label>
        <input
          id="venue_name"
          value={form.venue_name}
          onChange={(e) => update("venue_name", e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="address">
          Street Address <span className="hint">(optional)</span>
        </label>
        <input
          id="address"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="123 Main St"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="city">City *</label>
          <input
            id="city"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="state">State *</label>
          <input
            id="state"
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="venue_phone">
          Venue Phone <span className="hint">(optional)</span>
        </label>
        <input
          id="venue_phone"
          type="tel"
          value={form.venue_phone}
          onChange={(e) => update("venue_phone", e.target.value)}
          placeholder="(901) 555-0123"
        />
      </div>

      <div className="field">
        <label htmlFor="event_url">Event Website *</label>
        <input
          id="event_url"
          type="url"
          value={form.event_url}
          onChange={(e) => update("event_url", e.target.value)}
          placeholder="https://"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="cost">
          Cost <span className="hint">(optional)</span>
        </label>
        <input
          id="cost"
          type="number"
          step="0.01"
          min="0"
          value={form.cost}
          onChange={(e) => update("cost", e.target.value)}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="direction_from_memphis">
            Direction from Memphis <span className="hint">(optional)</span>
          </label>
          <select
            id="direction_from_memphis"
            value={form.direction_from_memphis}
            onChange={(e) =>
              update("direction_from_memphis", e.target.value as FormState["direction_from_memphis"])
            }
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="miles_from_downtown_memphis">
            Miles from Downtown Memphis <span className="hint">(optional)</span>
          </label>
          <input
            id="miles_from_downtown_memphis"
            type="number"
            step="0.1"
            min="0"
            value={form.miles_from_downtown_memphis}
            onChange={(e) => update("miles_from_downtown_memphis", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="submitter_name">Submitter Name *</label>
        <input
          id="submitter_name"
          value={form.submitter_name}
          onChange={(e) => update("submitter_name", e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="submitter_email">Submitter Email *</label>
        <input
          id="submitter_email"
          type="email"
          value={form.submitter_email}
          onChange={(e) => update("submitter_email", e.target.value)}
          required
        />
      </div>

      <div className="field checkbox-field">
        <input
          id="image_rights_confirmed"
          type="checkbox"
          checked={imageRightsConfirmed}
          onChange={(e) => setImageRightsConfirmed(e.target.checked)}
          required
        />
        <label htmlFor="image_rights_confirmed" style={{ fontWeight: 400 }}>
          I confirm I have the rights to use this image and grant permission
          for it to be published. *
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Event"}
        </button>
      </div>
    </form>
  );
}
