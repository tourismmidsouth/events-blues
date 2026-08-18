import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Filter } from "bad-words";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_OPTIONS, RECURRENCE_FREQUENCIES, RECURRENCE_MONTHLY_TYPES, normalizeUrl, slugify } from "@/lib/events";
import { sendEmail } from "@/lib/resend";
import type { SupabaseClient } from "@supabase/supabase-js";

const profanityFilter = new Filter();

// Verifies a Google reCAPTCHA v2 token server-side. Returns true (allow the
// submission through) if RECAPTCHA_SECRET_KEY isn't configured, so the app
// works with or without CAPTCHA set up.
async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// Appends -2, -3, ... until an unused slug is found.
async function uniqueSlug(supabase: SupabaseClient, title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  // Bounded loop: this only runs at submission time on a small table, and a
  // real collision run this long would indicate something else is wrong.
  for (let attempt = 0; attempt < 50; attempt++) {
    const { data } = await supabase.from("events").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const REQUIRED_TEXT_FIELDS = [
  "title",
  "description",
  "start_date",
  "venue_name",
  "city",
  "state",
  "event_url",
  "submitter_name",
  "submitter_email",
] as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const getString = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  const errors: string[] = [];

  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!getString(field)) {
      errors.push(`${field.replace(/_/g, " ")} is required.`);
    }
  }

  const submitterEmail = getString("submitter_email");
  if (submitterEmail && !isValidEmail(submitterEmail)) {
    errors.push("Submitter email is invalid.");
  }

  const eventUrlRaw = getString("event_url");
  const eventUrl = eventUrlRaw ? normalizeUrl(eventUrlRaw) : "";
  if (eventUrlRaw && !eventUrl) {
    errors.push("Event website must be a valid URL.");
  }

  const imageRightsConfirmed = formData.get("image_rights_confirmed") === "true";
  if (!imageRightsConfirmed) {
    errors.push("You must confirm you have rights to use this image.");
  }

  const direction = getString("direction_from_memphis") || "None";
  if (!DIRECTION_OPTIONS.includes(direction as (typeof DIRECTION_OPTIONS)[number])) {
    errors.push("Invalid direction from Memphis.");
  }

  const startDate = getString("start_date");
  const endDate = getString("end_date");
  if (endDate && startDate && endDate < startDate) {
    errors.push("End date cannot be before start date.");
  }

  const recurrenceFrequency = getString("recurrence_frequency") || "none";
  if (!RECURRENCE_FREQUENCIES.includes(recurrenceFrequency as (typeof RECURRENCE_FREQUENCIES)[number])) {
    errors.push("Invalid recurrence frequency.");
  }

  const recurrenceEndDate = getString("recurrence_end_date");
  if (recurrenceFrequency !== "none") {
    if (!recurrenceEndDate) {
      errors.push("Recurring events must have a recurrence end date.");
    } else if (recurrenceEndDate < startDate) {
      errors.push("Recurrence end date cannot be before the start date.");
    }
  }

  const recurrenceMonthlyType = getString("recurrence_monthly_type") || "date";
  if (!RECURRENCE_MONTHLY_TYPES.includes(recurrenceMonthlyType as (typeof RECURRENCE_MONTHLY_TYPES)[number])) {
    errors.push("Invalid monthly recurrence type.");
  }

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File) || imageFile.size === 0) {
    errors.push("Event image is required.");
  } else {
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      errors.push("Image must be a JPG, PNG, or WebP file.");
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      errors.push("Image must be 10 MB or smaller.");
    }
  }

  const costRaw = getString("cost");
  const milesRaw = getString("miles_from_downtown_memphis");

  if (costRaw && Number.isNaN(Number(costRaw))) {
    errors.push("Cost must be a number.");
  }
  if (milesRaw && Number.isNaN(Number(milesRaw))) {
    errors.push("Miles from downtown Memphis must be a number.");
  }

  // Checked against every free-text field a submitter controls. A flagged
  // submission is rejected outright here — nothing is saved or uploaded, so
  // it never reaches the admin dashboard for review.
  const textToScreen = [
    getString("title"),
    getString("description"),
    getString("venue_name"),
    getString("address"),
    getString("submitter_name"),
  ].join(" \n ");
  if (profanityFilter.isProfane(textToScreen)) {
    errors.push(
      "This submission contains language that isn't allowed. Please revise it and try again."
    );
  }

  const recaptchaToken = getString("recaptcha_token");
  if (!(await verifyRecaptcha(recaptchaToken))) {
    errors.push("CAPTCHA verification failed. Please try again.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const supabase = createAdminClient();

  const file = imageFile as File;
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const imagePath = `submissions/${randomUUID()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("event-images")
    .upload(imagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("event-images").getPublicUrl(imagePath);

  const slug = await uniqueSlug(supabase, getString("title"));

  const { error: insertError } = await supabase.from("events").insert({
    slug,
    title: getString("title"),
    description: getString("description"),
    image_url: publicUrl,
    image_path: imagePath,
    start_date: startDate,
    start_time: getString("start_time") || null,
    end_date: endDate || null,
    end_time: getString("end_time") || null,
    venue_name: getString("venue_name"),
    address: getString("address") || null,
    city: getString("city"),
    state: getString("state"),
    venue_phone: getString("venue_phone") || null,
    event_url: eventUrl,
    cost: costRaw ? Number(costRaw) : null,
    direction_from_memphis: direction,
    miles_from_downtown_memphis: milesRaw ? Number(milesRaw) : null,
    recurrence_frequency: recurrenceFrequency,
    recurrence_end_date: recurrenceFrequency !== "none" ? recurrenceEndDate : null,
    recurrence_monthly_type: recurrenceFrequency === "monthly" ? recurrenceMonthlyType : "date",
    submitter_name: getString("submitter_name"),
    submitter_email: submitterEmail,
    image_rights_confirmed: imageRightsConfirmed,
    moderation_status: "submitted",
  });

  if (insertError) {
    await supabase.storage.from("event-images").remove([imagePath]);
    return NextResponse.json(
      { error: "Failed to save event. Please try again." },
      { status: 500 }
    );
  }

  try {
    await sendEmail({
      to: "tourism@midsouthdd.org",
      subject: "New event submission awaiting review",
      text: `A new event was just submitted: "${getString("title")}"

Log in to review it here: https://events.bluesbackroads.com/admin/login`,
    });
  } catch (err) {
    console.error("Failed to send new-submission alert email:", err);
  }

  return NextResponse.json({ success: true });
}
