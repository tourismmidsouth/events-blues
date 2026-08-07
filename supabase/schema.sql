-- Blues Backroads event submission app schema
-- Run this in the Supabase SQL editor. Safe to re-run: uses IF NOT EXISTS /
-- CREATE OR REPLACE / DROP+CREATE POLICY throughout, so re-running it after
-- a schema update (e.g. adding a column) will bring an existing project
-- up to date without touching existing data.

create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text not null,
  description text not null,
  image_url text,
  image_path text,
  start_date date not null,
  start_time time,
  end_date date,
  end_time time,
  venue_name text,
  address text,
  city text,
  state text,
  venue_phone text,
  event_url text,
  cost numeric,
  direction_from_memphis text,
  miles_from_downtown_memphis numeric,
  recurrence_frequency text not null default 'none',
  recurrence_end_date date,
  submitter_name text not null,
  submitter_email text not null,
  image_rights_confirmed boolean not null default false,
  moderation_status text not null default 'submitted',
  submitted_at timestamptz default now(),
  published_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz default now()
);

-- Columns added after the initial release. Adding them here too (guarded
-- with IF NOT EXISTS) means re-running this whole file against an existing
-- project brings it up to date.
alter table events add column if not exists address text;
alter table events add column if not exists recurrence_frequency text not null default 'none';
alter table events add column if not exists recurrence_end_date date;
alter table events add column if not exists venue_phone text;
alter table events add column if not exists slug text;

-- Backfill slugs for any existing rows that don't have one yet (new rows
-- get theirs computed by the app at submission time, with the same
-- collision-suffix scheme). Safe to re-run: only fills in nulls.
update events
set slug = sub.new_slug
from (
  select
    id,
    case when rn = 1 then base_slug else base_slug || '-' || rn::text end as new_slug
  from (
    select
      id,
      nullif(regexp_replace(regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'), '') as base_slug,
      row_number() over (
        partition by regexp_replace(regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
        order by submitted_at, id
      ) as rn
    from events
    where slug is null
  ) numbered
) sub
where events.id = sub.id
  and sub.base_slug is not null;

update events set slug = 'event-' || substr(id::text, 1, 8) where slug is null;

alter table events alter column slug set not null;

drop index if exists events_slug_idx;
create unique index events_slug_idx on events (slug);

alter table events drop constraint if exists moderation_status_check;
alter table events add constraint moderation_status_check check (
  moderation_status in ('submitted', 'published', 'rejected', 'archived')
);

alter table events drop constraint if exists direction_from_memphis_check;
alter table events add constraint direction_from_memphis_check check (
  direction_from_memphis is null
  or direction_from_memphis in ('None', 'North', 'East', 'South', 'West')
);

alter table events drop constraint if exists recurrence_frequency_check;
alter table events add constraint recurrence_frequency_check check (
  recurrence_frequency in ('none', 'daily', 'weekly', 'monthly')
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
--
-- A recurring event (recurrence_frequency <> 'none') is treated as past only
-- once its recurrence_end_date has passed (or, if that's blank, it's treated
-- as an ongoing series and never hidden this way). A non-recurring event is
-- past once its end_date (or start_date if end_date is blank) has passed.
drop policy if exists "Public can read published upcoming events" on events;
create policy "Public can read published upcoming events"
  on events
  for select
  to anon
  using (
    moderation_status = 'published'
    and (
      (
        recurrence_frequency <> 'none'
        and (recurrence_end_date is null or recurrence_end_date >= current_date)
      )
      or (
        recurrence_frequency = 'none'
        and coalesce(end_date, start_date) >= current_date
      )
    )
  );

-- Authenticated (admin) users can do everything. All admin users of this
-- app are trusted staff created manually in Supabase Auth.
drop policy if exists "Admins can read all events" on events;
create policy "Admins can read all events"
  on events
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can update events" on events;
create policy "Admins can update events"
  on events
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admins can delete events" on events;
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

drop policy if exists "Public can view event images" on storage.objects;
create policy "Public can view event images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'event-images');

drop policy if exists "Admins can manage event images" on storage.objects;
create policy "Admins can manage event images"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'event-images')
  with check (bucket_id = 'event-images');

-- Uploads from the public submission form go through the server-side API
-- route using the service role key, which bypasses storage RLS as well.
