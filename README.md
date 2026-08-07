# Blues Backroads Events

A minimal event submission and moderation app built with Next.js, TypeScript,
and Supabase.

## Features

- `/submit-event` — public event submission form
- `/admin/login` — admin email/password login (Supabase Auth)
- `/admin/events` — admin dashboard (approve, reject, archive, edit, delete)
- `/embed/events/gallery` — public gallery of published, upcoming events for
  embedding in Squarespace

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

## Embedding the gallery in Squarespace

The gallery page (`/embed/events/gallery`) supports a few query string
options:

- `?limit=3` — show only the next N upcoming occurrences (useful for a
  homepage teaser)
- `?view=grid` or `?view=list` — starting view (defaults to `grid`)
- `?toggle=0` — hide the Grid/List switcher (useful for a compact embed
  where you've already picked a fixed view)
- `?title=0` — hide the "Upcoming Blues Backroads Events" heading (useful
  when the surrounding page already has its own heading)

A recurring event (e.g. "every Thursday in September") shows up as one
card per date, not a single "weekly" card.

### Full events calendar (with grid/list toggle)

Add a **Code Block** in Squarespace 7.1 with:

```html
<iframe
  id="blues-backroads-gallery"
  src="https://YOUR-VERCEL-DOMAIN.vercel.app/embed/events/gallery"
  width="100%"
  height="1000"
  style="border:0; display:block;"
  loading="lazy"
  title="Blues Backroads Events">
</iframe>
<script>
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "blues-backroads-gallery-height") {
      var iframe = document.getElementById("blues-backroads-gallery");
      if (iframe) iframe.style.height = event.data.height + "px";
    }
  });
</script>
```

The script listens for a height message the page posts whenever its
content changes (view toggled, modal opened) and resizes the iframe to
match — this keeps it from getting clipped or leaving extra blank space on
mobile, where card layout height varies a lot. If you embed the gallery
more than once on the same page (e.g. once here and once for the homepage
snippet below), give each iframe a unique `id` and match it in its own
`<script>` block.

### Homepage teaser: 3 most upcoming events

Same idea, scoped down with query params — a compact list of the next 3
events, no heading, no view toggle:

```html
<iframe
  id="blues-backroads-upcoming"
  src="https://YOUR-VERCEL-DOMAIN.vercel.app/embed/events/gallery?limit=3&view=list&toggle=0&title=0"
  width="100%"
  height="400"
  style="border:0; display:block;"
  loading="lazy"
  title="Upcoming Blues Backroads Events">
</iframe>
<script>
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "blues-backroads-gallery-height") {
      var iframe = document.getElementById("blues-backroads-upcoming");
      if (iframe) iframe.style.height = event.data.height + "px";
    }
  });
</script>
```

Swap `view=list` for `view=grid` if you'd rather show 3 image cards
instead of a compact list.

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
