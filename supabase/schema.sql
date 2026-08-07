-- Blues Backroads event submission app schema
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text,
  image_path text,
  start_date date not null,
  start_time time,
  end_date date,
  end_time time,
  venue_name text,
  city text,
  state text,
  event_url text,
  cost numeric,
  direction_from_memphis text,
  miles_from_downtown_memphis numeric,
  submitter_name text not null,
  submitter_email text not null,
  image_rights_confirmed boolean not null default false,
  moderation_status text not null default 'submitted',
  submitted_at timestamptz default now(),
  published_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz default now(),
  constraint moderation_status_check check (
    moderation_status in ('submitted', 'published', 'rejected', 'archived')
  ),
  constraint direction_from_memphis_check check (
    direction_from_memphis is null
    or direction_from_memphis in ('None', 'North', 'East', 'South', 'West')
  )
);

create index if not exists events_moderation_status_idx on events (moderation_status);
create index if not exists events_end_date_idx on events (end_date);
create index if not exists events_start_date_idx on events (start_date);

-- Keep updated_at current on every row change.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row
  execute function set_updated_at();

-- Row Level Security -----------------------------------------------------

alter table events enable row level security;

-- Public (anon) can only read published, non-past events, and only the
-- public-safe columns are ever selected for by the app (submitter name and
-- email are never queried by the public gallery routes). RLS still allows
-- reads of all columns on matching rows, so the gallery/API routes MUST
-- select an explicit column list that excludes submitter_name/submitter_email
-- when serving public responses.
create policy "Public can read published upcoming events"
  on events
  for select
  to anon
  using (
    moderation_status = 'published'
    and coalesce(end_date, start_date) >= current_date
  );

-- Authenticated (admin) users can do everything. All admin users of this
-- app are trusted staff created manually in Supabase Auth.
create policy "Admins can read all events"
  on events
  for select
  to authenticated
  using (true);

create policy "Admins can update events"
  on events
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Admins can delete events"
  on events
  for delete
  to authenticated
  using (true);

-- No insert policy for anon/authenticated: submissions are written by the
-- server-side API route using the service role key, which bypasses RLS.

-- Storage ------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view event images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'event-images');

create policy "Admins can manage event images"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'event-images')
  with check (bucket_id = 'event-images');

-- Uploads from the public submission form go through the server-side API
-- route using the service role key, which bypasses storage RLS as well.
