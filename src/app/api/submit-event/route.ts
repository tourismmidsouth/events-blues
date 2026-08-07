import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_OPTIONS, RECURRENCE_FREQUENCIES } from "@/lib/events";

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

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
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

  const eventUrl = getString("event_url");
  if (eventUrl && !isValidUrl(eventUrl)) {
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

  const { error: insertError } = await supabase.from("events").insert({
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

  return NextResponse.json({ success: true });
}
