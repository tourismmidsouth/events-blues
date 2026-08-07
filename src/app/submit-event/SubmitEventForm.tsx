"use client";

import { useState, useRef } from "react";
import { DIRECTION_OPTIONS } from "@/lib/events";

export default function SubmitEventForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = formRef.current;
    if (!form) return;

    const imageRightsConfirmed = (
      form.elements.namedItem("image_rights_confirmed") as HTMLInputElement
    )?.checked;

    const formData = new FormData(form);
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
    <form ref={formRef} className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">Event Title *</label>
        <input id="title" name="title" type="text" required />
      </div>

      <div className="field">
        <label htmlFor="description">Event Description *</label>
        <textarea id="description" name="description" required />
      </div>

      <div className="field">
        <label htmlFor="image">Event Image *</label>
        <span className="hint">JPG, PNG, or WebP. Max 10 MB.</span>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="start_date">Start Date *</label>
          <input id="start_date" name="start_date" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="end_date">
            End Date <span className="hint">(optional)</span>
          </label>
          <input id="end_date" name="end_date" type="date" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="start_time">
            Start Time <span className="hint">(optional, Central time)</span>
          </label>
          <input id="start_time" name="start_time" type="time" />
        </div>
        <div className="field">
          <label htmlFor="end_time">
            End Time <span className="hint">(optional, Central time)</span>
          </label>
          <input id="end_time" name="end_time" type="time" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="venue_name">Venue Name *</label>
        <input id="venue_name" name="venue_name" type="text" required />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="city">City *</label>
          <input id="city" name="city" type="text" required />
        </div>
        <div className="field">
          <label htmlFor="state">State *</label>
          <input id="state" name="state" type="text" required />
        </div>
      </div>

      <div className="field">
        <label htmlFor="event_url">Event Website *</label>
        <input id="event_url" name="event_url" type="url" placeholder="https://" required />
      </div>

      <div className="field">
        <label htmlFor="cost">
          Cost <span className="hint">(optional)</span>
        </label>
        <input id="cost" name="cost" type="number" step="0.01" min="0" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="direction_from_memphis">
            Direction from Memphis <span className="hint">(optional)</span>
          </label>
          <select id="direction_from_memphis" name="direction_from_memphis" defaultValue="None">
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
            name="miles_from_downtown_memphis"
            type="number"
            step="0.1"
            min="0"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="submitter_name">Submitter Name *</label>
        <input id="submitter_name" name="submitter_name" type="text" required />
      </div>

      <div className="field">
        <label htmlFor="submitter_email">Submitter Email *</label>
        <input id="submitter_email" name="submitter_email" type="email" required />
      </div>

      <div className="field checkbox-field">
        <input
          id="image_rights_confirmed"
          name="image_rights_confirmed"
          type="checkbox"
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
