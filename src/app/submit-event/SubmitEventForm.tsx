"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import {
  DIRECTION_OPTIONS,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_MONTHLY_TYPES,
  describeMonthlyDate,
  describeMonthlyWeekday,
  describeWeekday,
} from "@/lib/events";

interface Grecaptcha {
  render: (container: HTMLElement, params: Record<string, unknown>) => number;
  getResponse: (widgetId?: number) => string;
  reset: (widgetId?: number) => void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    onRecaptchaLoad?: () => void;
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

type FormState = {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  recurrence_frequency: (typeof RECURRENCE_FREQUENCIES)[number];
  recurrence_end_date: string;
  recurrence_monthly_type: (typeof RECURRENCE_MONTHLY_TYPES)[number];
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
  recurrence_monthly_type: "date",
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

export default function SubmitEventForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaWidgetId = useRef<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageRightsConfirmed, setImageRightsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showTicketOption, setShowTicketOption] = useState(false);
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function renderRecaptcha() {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha || !recaptchaContainerRef.current) return;
    if (recaptchaWidgetId.current !== null) return;
    recaptchaWidgetId.current = window.grecaptcha.render(recaptchaContainerRef.current, {
      sitekey: RECAPTCHA_SITE_KEY,
    });
  }

  useEffect(() => {
    if (RECAPTCHA_SITE_KEY && window.grecaptcha) {
      renderRecaptcha();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageFile(e.target.files?.[0] || null);
  }

  async function handleTicketSubmit() {
    setTicketSubmitting(true);
    try {
      await fetch("/api/support-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ticketEmail, details: error }),
      });
    } finally {
      setTicketSubmitting(false);
      setTicketSent(true);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setShowTicketOption(false);
    setTicketSent(false);

    if (!imageFile) {
      setError("Event image is required.");
      return;
    }

    let recaptchaToken = "";
    if (RECAPTCHA_SITE_KEY) {
      recaptchaToken = window.grecaptcha?.getResponse(recaptchaWidgetId.current ?? undefined) || "";
      if (!recaptchaToken) {
        setError("Please complete the CAPTCHA.");
        return;
      }
    }

    const formData = new FormData();
    formData.set("image", imageFile);
    Object.entries(form).forEach(([key, value]) => formData.set(key, value));
    formData.set("image_rights_confirmed", imageRightsConfirmed ? "true" : "false");
    formData.set("recaptcha_token", recaptchaToken);

    setSubmitting(true);
    try {
      const response = await fetch("/api/submit-event", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong. Please try again.");
        setShowTicketOption(true);
        setSubmitting(false);
        if (RECAPTCHA_SITE_KEY && window.grecaptcha) {
          window.grecaptcha.reset(recaptchaWidgetId.current ?? undefined);
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setShowTicketOption(true);
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
        <span className="hint">JPG, PNG, or WebP. Max 10 MB.</span>
        <input
          ref={fileInputRef}
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
        />
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
        {form.recurrence_frequency === "weekly" && form.start_date && (
          <span className="hint">Repeats every {describeWeekday(form.start_date)}.</span>
        )}
      </div>

      {form.recurrence_frequency === "monthly" && (
        <div className="field">
          <label htmlFor="recurrence_monthly_type">Monthly Repeat Pattern</label>
          <select
            id="recurrence_monthly_type"
            value={form.recurrence_monthly_type}
            onChange={(e) =>
              update("recurrence_monthly_type", e.target.value as FormState["recurrence_monthly_type"])
            }
          >
            <option value="date">
              Same date each month{form.start_date ? ` (the ${describeMonthlyDate(form.start_date)})` : ""}
            </option>
            <option value="weekday">
              Same weekday each month{form.start_date ? ` (${describeMonthlyWeekday(form.start_date)})` : ""}
            </option>
          </select>
        </div>
      )}

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
          type="text"
          value={form.event_url}
          onChange={(e) => update("event_url", e.target.value)}
          placeholder="facebook.com/yourevent"
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

      {RECAPTCHA_SITE_KEY && (
        <>
          <Script
            src="https://www.google.com/recaptcha/api.js"
            strategy="lazyOnload"
            onReady={renderRecaptcha}
            onLoad={renderRecaptcha}
          />
          <div ref={recaptchaContainerRef} />
        </>
      )}

      {error && <p className="error-text">{error}</p>}

      {showTicketOption &&
        (ticketSent ? (
          <p>Thanks — we&apos;ll be in touch within 1 business day.</p>
        ) : (
          <div className="field">
            <label htmlFor="ticket_email">
              Still having trouble? Enter your email and we&apos;ll help
              resolve this within 1 business day.
            </label>
            <input
              id="ticket_email"
              type="email"
              value={ticketEmail}
              onChange={(e) => setTicketEmail(e.target.value)}
            />
            <div>
              <button
                type="button"
                onClick={handleTicketSubmit}
                disabled={ticketSubmitting || !ticketEmail}
              >
                {ticketSubmitting ? "Sending…" : "Send Support Request"}
              </button>
            </div>
          </div>
        ))}

      <div>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Event"}
        </button>
      </div>
    </form>
  );
}
