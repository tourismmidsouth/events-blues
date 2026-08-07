# Blues Backroads Events

A minimal event submission and moderation app built with Next.js, TypeScript,
and Supabase.

## Features

- `/submit-event` — public event submission form
- `/admin/login` — admin email/password login (Supabase Auth)
- `/admin/events` — admin dashboard (approve, reject, archive, edit, delete)
- `/embed/events/gallery` — public gallery of published, upcoming events for
  embedding in Squarespace
- AI flyer reading on `/submit-event` — uploading an event flyer image
  automatically pre-fills the form via Claude's vision API (optional, see
  below); the submitter still reviews and can correct everything before
  submitting

## Setup

### 1. Create a Supabase project

Create a new project at [supabase.com](https://supabase.com).

### 2. Run the database schema

In the Supabase SQL Editor, run the contents of `supabase/schema.sql`. This
creates the `events` table, enables Row Level Security, and creates the
public `event-images` storage bucket.

### 3. Create the admin user

In **Supabase Dashboard → Authentication → Users → Add User**, create a user
with the admin's email address and the password `BluesBR123!`. The password
is set directly in the Supabase dashboard — it is never stored in this
repository, in environment variables, or in any frontend code.

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project
values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The anon key is safe for the browser. The service role key must **only** be
set as a server-side environment variable (never `NEXT_PUBLIC_*`) — it is
used exclusively in the `/api/submit-event` server route to upload images
and insert submissions on behalf of unauthenticated visitors.

### 5. Install and run

```bash
npm install
npm run dev
```

### 6. Deploy to Vercel

Push this repo to GitHub and import it into Vercel. Add the same four
environment variables in the Vercel project settings, then deploy.

### 7. (Optional) Enable AI flyer reading

Get an API key from [console.anthropic.com](https://console.anthropic.com),
then add it as a server-side environment variable (never `NEXT_PUBLIC_*`):

```
ANTHROPIC_API_KEY=your-anthropic-api-key
```

With this set, uploading an image on `/submit-event` sends it to
`/api/extract-event-details`, which asks Claude to read the flyer and
returns a best-effort guess at the title, dates, times, venue, address,
cost, and recurrence — the form is pre-filled but nothing is ever saved
without the submitter reviewing and clicking Submit. Without this key set,
the image upload field just works normally with no auto-fill step; nothing
else breaks.

This calls the Anthropic API directly from your server and is billed to
your own Anthropic account per the API's usual per-image/per-token pricing
— it's a separate cost from Supabase/Vercel.

## Embedding the gallery in Squarespace

Add a Code Block in Squarespace 7.1 with:

```html
<iframe
  src="https://YOUR-VERCEL-DOMAIN.vercel.app/embed/events/gallery"
  width="100%"
  height="1000"
  frameborder="0"
  loading="lazy"
  title="Blues Backroads Events">
</iframe>
```

## How past events are hidden

No cron job is required. The public gallery query filters out any event
whose `end_date` (or `start_date` if `end_date` is blank) is before today,
evaluated in the `America/Chicago` timezone. Past events remain visible in
the admin dashboard so admins can manually archive them.

## Security notes

- Row Level Security is enabled on the `events` table. The `anon` role can
  only read rows where `moderation_status = 'published'` and the event
  hasn't passed. The public gallery route also explicitly selects a column
  list that excludes `submitter_name` and `submitter_email`, so private
  submitter details are never sent to the browser.
- Only authenticated (admin) users can update or delete events, per RLS
  policy.
- The public submission route (`/api/submit-event`) runs entirely
  server-side using the Supabase service role key, so anonymous visitors
  never need direct insert access to the database.
- `/admin/*` routes are protected by middleware that checks for a valid
  Supabase Auth session and redirects unauthenticated users to
  `/admin/login`.
