# Blues Backroads Events

A minimal event submission and moderation app built with Next.js, TypeScript,
and Supabase.

## Features

- `/submit-event` — public event submission form
- `/admin/login` — admin email/password login (Supabase Auth)
- `/admin/events` — admin dashboard (approve, reject, archive, edit, delete)
- `/embed/events/gallery` — public gallery of published, upcoming events for
  embedding in Squarespace
- `/event/[slug]/[date]` — a standalone, SEO-indexable page for a single
  event occurrence, with Open Graph tags and schema.org `Event` structured
  data

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
- `?cardLinkUrl=https://bluesbackroads.com/events` — instead of opening the
  detail popup, clicking any card opens this URL in a new tab (useful for a
  homepage teaser that should send people to your full Events page rather
  than showing details inline)

A recurring event (e.g. "every Thursday in September") shows up as one
card per date, not a single "weekly" card. Clicking a card opens a detail
popup with an **Add to Google Calendar** link, a **Download .ics** link
(Apple Calendar/Outlook), and a link to that event's own full page (see
"Individual event pages" below) — unless `cardLinkUrl` is set, in which
case cards link out instead of opening the popup.

Both snippets below include a listener script that does two things as the
page posts messages to it:
1. Resizes the iframe to exactly fit its content (no internal scrollbar,
   ever — the iframe grows/shrinks instead)
2. Scrolls the parent page to the top when someone opens the detail popup,
   so it's immediately visible with no scrolling needed

If you embed the gallery more than once on the same Squarespace page, give
each iframe a unique `id` and each `<script>` block its own matching `id`
reference, same as the two examples below.

### Full events calendar (with grid/list toggle)

Add a **Code Block** in Squarespace 7.1 with:

```html
<iframe
  id="blues-backroads-gallery"
  src="https://YOUR-VERCEL-DOMAIN.vercel.app/embed/events/gallery"
  width="100%"
  height="1000"
  scrolling="no"
  style="border:0; display:block; overflow:hidden;"
  loading="lazy"
  title="Blues Backroads Events">
</iframe>
<script>
  window.addEventListener("message", function (event) {
    var iframe = document.getElementById("blues-backroads-gallery");
    if (!iframe || !event.data) return;
    if (event.data.type === "blues-backroads-gallery-height") {
      iframe.style.height = event.data.height + "px";
    } else if (event.data.type === "blues-backroads-scroll-top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
</script>
```

### Homepage teaser: 3 most upcoming events (grid, click-through to your Events page)

```html
<iframe
  id="blues-backroads-upcoming"
  src="https://YOUR-VERCEL-DOMAIN.vercel.app/embed/events/gallery?limit=3&view=grid&toggle=0&title=0&cardLinkUrl=https%3A%2F%2Fbluesbackroads.com%2Fevents"
  width="100%"
  height="500"
  scrolling="no"
  style="border:0; display:block; overflow:hidden;"
  loading="lazy"
  title="Upcoming Blues Backroads Events">
</iframe>
<script>
  window.addEventListener("message", function (event) {
    var iframe = document.getElementById("blues-backroads-upcoming");
    if (!iframe || !event.data) return;
    if (event.data.type === "blues-backroads-gallery-height") {
      iframe.style.height = event.data.height + "px";
    }
  });
</script>
```

This shows 3 image cards; clicking any of them opens
`https://bluesbackroads.com/events` in a new tab instead of the detail
popup (change the `cardLinkUrl` value — URL-encoded — if your Events page
lives at a different address). Since cards never open the popup here, the
scroll-to-top listener isn't needed on this one.

## Individual event pages (SEO)

Every event occurrence gets its own standalone, indexable page at:

```
/event/<slug>/<occurrence-date>/
```

e.g. `/event/hernando-farmers-market/2026-05-30/`. The slug is generated
automatically from the event's title when it's submitted (lowercased,
non-alphanumeric characters replaced with hyphens; a numeric suffix like
`-2` is appended if two events would otherwise collide). Each page has its
own `<title>`, meta description, Open Graph/Twitter card tags (so it looks
right when shared), and schema.org `Event` JSON-LD structured data (so
Google can potentially show it as a rich result) — plus the same Add to
Calendar links as the popup.

**About getting these at `bluesbackroads.com/event/...` specifically:**
this app is deployed on Vercel, and Squarespace itself has no way to
reverse-proxy a path like `/event/*` to an external app while the rest of
`bluesbackroads.com` stays on Squarespace — that's a Squarespace platform
limitation, not something fixable in this codebase. There are two real
options, and which one works depends on where your domain's DNS is
managed:

1. **A subdomain**, e.g. `events.bluesbackroads.com`, pointed at this
   Vercel app via a CNAME record. This works regardless of DNS provider
   and is a 10-minute change, but the URL becomes
   `events.bluesbackroads.com/event/hernando-farmers-market/2026-05-30/`
   (a different hostname, not a path under the main domain).
2. **True path-based routing** so `bluesbackroads.com/event/*` transparently
   proxies to this Vercel app while everything else stays on Squarespace.
   This requires your DNS to run through a provider that supports
   edge/worker-level routing (e.g. Cloudflare Workers) — it is not possible
   with Squarespace's own default DNS. If your domain's nameservers are
   already Cloudflare (or similar), this is doable; if DNS is on
   Squarespace's own nameservers, it isn't, without moving DNS first.

Tell me which of these matches your setup (or ask if you're not sure where
your DNS is hosted) and I can help configure whichever is actually
available to you — this part depends on your hosting setup, not just code
changes here.

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
