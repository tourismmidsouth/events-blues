import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DIRECTION_OPTIONS, RECURRENCE_FREQUENCIES, todayInChicago } from "@/lib/events";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Shape the model is asked to return. Every field is a best-effort guess
// from the flyer image and must be reviewed by the person submitting the
// event before the form is actually sent — this endpoint never writes
// anything to the database itself.
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

const EMPTY_RESULT: ExtractedEventDetails = {
  title: null,
  description: null,
  start_date: null,
  end_date: null,
  start_time: null,
  end_time: null,
  venue_name: null,
  address: null,
  city: null,
  state: null,
  venue_phone: null,
  event_url: null,
  cost: null,
  direction_from_memphis: null,
  recurrence_frequency: null,
  recurrence_end_date: null,
};

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "AI flyer reading isn't configured on this deployment." },
      { status: 501 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File) || imageFile.size === 0) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
    return NextResponse.json(
      { error: "Image must be a JPG, PNG, or WebP file." },
      { status: 400 }
    );
  }
  if (imageFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 400 });
  }

  const arrayBuffer = await imageFile.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const today = todayInChicago();

  const prompt = `You are reading an event flyer/poster image to help pre-fill a public event submission form. Extract as much of the following as you can confidently read from the image. Today's date is ${today} (America/Chicago timezone) — use it to resolve dates that omit a year (assume the next upcoming occurrence of that date).

Respond with ONLY a single JSON object (no markdown fences, no commentary) with exactly these keys:
- title: string or null
- description: string or null (a 2-4 sentence summary of what's on the flyer; do not just repeat the title)
- start_date: string "YYYY-MM-DD" or null
- end_date: string "YYYY-MM-DD" or null (only if the flyer clearly states a different end date than the start date)
- start_time: string "HH:MM" 24-hour or null
- end_time: string "HH:MM" 24-hour or null
- venue_name: string or null
- address: string or null (street address only)
- city: string or null
- state: string or null (2-letter abbreviation if shown, e.g. "TN", "MS")
- venue_phone: string or null
- event_url: string or null (a website or social media URL if shown)
- cost: number or null (0 if the flyer says "free", otherwise the numeric price; null if not shown)
- direction_from_memphis: one of ${JSON.stringify(DIRECTION_OPTIONS)} or null (only set this if the flyer itself states a direction/region relative to Memphis; otherwise null — do not guess from city name alone)
- recurrence_frequency: one of ${JSON.stringify(RECURRENCE_FREQUENCIES)} or null (set to "weekly"/"daily"/"monthly" only if the flyer clearly describes a repeating schedule, e.g. "every Thursday"; otherwise "none")
- recurrence_end_date: string "YYYY-MM-DD" or null (the last date the recurring event occurs, if stated or clearly implied, e.g. "every Thursday in September" implies the last Thursday of that September)

If a field isn't shown on the flyer or you aren't reasonably confident, use null rather than guessing. Every value you return will be shown to a human for review before anything is saved, so it's fine to leave fields null.`;

  let responseText: string;
  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageFile.type,
          data: base64,
        },
      },
      prompt,
    ]);
    responseText = result.response.text();
  } catch {
    return NextResponse.json(
      { error: "Couldn't read the flyer right now. Please fill in the form manually." },
      { status: 502 }
    );
  }

  let parsed: Partial<ExtractedEventDetails>;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
  } catch {
    return NextResponse.json({ result: EMPTY_RESULT });
  }

  const result: ExtractedEventDetails = { ...EMPTY_RESULT, ...parsed };

  return NextResponse.json({ result });
}
