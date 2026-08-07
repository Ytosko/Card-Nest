-- CardNest initial cloud schema.
-- All application data is private to the authenticated owner through RLS.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 120)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_ai_provider text,
  selected_ai_model text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_preferences_ai_provider_check
    check (selected_ai_provider is null or selected_ai_provider in ('openai', 'gemini')),
  constraint user_preferences_ai_model_length
    check (selected_ai_model is null or char_length(selected_ai_model) <= 160)
);

create table public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free',
  policy_version integer not null default 1,
  disabled_features text[] not null default '{}',
  valid_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_entitlements_tier_check check (tier in ('free', 'pro', 'team', 'disabled')),
  constraint user_entitlements_policy_version_check check (policy_version > 0)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  status text not null default 'capture_pending',
  display_name text,
  first_name text,
  middle_name text,
  last_name text,
  company text,
  job_title text,
  department text,
  primary_email text,
  primary_phone text,
  website text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  notes text,
  raw_extracted_text text,
  extraction_provider text,
  extraction_model text,
  extraction_confidence numeric(5, 4),
  extraction_quality jsonb not null default '{}'::jsonb,
  source_front_image_path text,
  source_back_image_path text,
  source_hash text,
  duplicate_of_id uuid,
  is_favorite boolean not null default false,
  last_exported_to_contacts_at timestamptz,
  search_vector tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(display_name, '') || ' ' ||
      coalesce(first_name, '') || ' ' ||
      coalesce(middle_name, '') || ' ' ||
      coalesce(last_name, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(job_title, '') || ' ' ||
      coalesce(department, '') || ' ' ||
      coalesce(primary_email, '') || ' ' ||
      coalesce(primary_phone, '') || ' ' ||
      coalesce(website, '') || ' ' ||
      coalesce(address_line_1, '') || ' ' ||
      coalesce(address_line_2, '') || ' ' ||
      coalesce(city, '') || ' ' ||
      coalesce(state_region, '') || ' ' ||
      coalesce(postal_code, '') || ' ' ||
      coalesce(country, '') || ' ' ||
      coalesce(notes, '') || ' ' ||
      coalesce(raw_extracted_text, '')
    )
  ) stored,
  constraint cards_id_user_id_key unique (id, user_id),
  constraint cards_status_check
    check (status in ('capture_pending', 'uploading', 'processing', 'review', 'ready', 'failed', 'archived')),
  constraint cards_extraction_provider_check
    check (extraction_provider is null or extraction_provider in ('openai', 'gemini', 'manual')),
  constraint cards_extraction_confidence_check
    check (extraction_confidence is null or extraction_confidence between 0 and 1),
  constraint cards_extraction_quality_object_check
    check (jsonb_typeof(extraction_quality) = 'object'),
  constraint cards_duplicate_self_check check (duplicate_of_id is null or duplicate_of_id <> id),
  constraint cards_duplicate_owner_fk
    foreign key (duplicate_of_id, user_id)
    references public.cards(id, user_id)
    on delete set null (duplicate_of_id)
);

create table public.card_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null,
  email text not null,
  normalized_email text generated always as (lower(btrim(email))) stored,
  label text not null default 'work',
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint card_emails_card_owner_fk
    foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade,
  constraint card_emails_email_not_blank check (char_length(btrim(email)) > 0),
  constraint card_emails_label_check check (label in ('work', 'personal', 'other')),
  constraint card_emails_unique_per_card unique (card_id, normalized_email)
);

create table public.card_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null,
  phone_number text not null,
  normalized_phone text generated always as (regexp_replace(phone_number, '[^0-9+]', '', 'g')) stored,
  label text not null default 'work',
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint card_phone_numbers_card_owner_fk
    foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade,
  constraint card_phone_numbers_phone_not_blank check (char_length(btrim(phone_number)) > 0),
  constraint card_phone_numbers_label_check check (label in ('mobile', 'work', 'home', 'fax', 'other')),
  constraint card_phone_numbers_unique_per_card unique (card_id, normalized_phone)
);

create table public.card_websites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null,
  url text not null,
  label text not null default 'work',
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint card_websites_card_owner_fk
    foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade,
  constraint card_websites_url_not_blank check (char_length(btrim(url)) > 0),
  constraint card_websites_label_check check (label in ('work', 'portfolio', 'social', 'other')),
  constraint card_websites_unique_per_card unique (card_id, url)
);

create table public.card_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null,
  label text not null default 'work',
  address_line_1 text,
  address_line_2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint card_addresses_card_owner_fk
    foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade,
  constraint card_addresses_label_check check (label in ('work', 'home', 'other')),
  constraint card_addresses_has_content check (
    nullif(btrim(address_line_1), '') is not null
    or nullif(btrim(address_line_2), '') is not null
    or nullif(btrim(city), '') is not null
    or nullif(btrim(state_region), '') is not null
    or nullif(btrim(postal_code), '') is not null
    or nullif(btrim(country), '') is not null
  )
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tags_id_user_id_key unique (id, user_id),
  constraint tags_name_not_blank check (char_length(btrim(name)) between 1 and 60),
  constraint tags_color_format check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.card_tags (
  user_id uuid not null,
  card_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (card_id, tag_id),
  constraint card_tags_card_owner_fk
    foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade,
  constraint card_tags_tag_owner_fk
    foreign key (tag_id, user_id) references public.tags(id, user_id) on delete cascade
);

create table public.card_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null,
  side text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint,
  width integer,
  height integer,
  sha256 text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint card_images_card_owner_fk
    foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade,
  constraint card_images_side_check check (side in ('front', 'back')),
  constraint card_images_storage_path_not_blank check (char_length(btrim(storage_path)) > 0),
  constraint card_images_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  constraint card_images_byte_size_check check (byte_size is null or byte_size > 0),
  constraint card_images_dimensions_check check ((width is null and height is null) or (width > 0 and height > 0)),
  constraint card_images_unique_side unique (card_id, side),
  constraint card_images_unique_path unique (storage_path)
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid,
  job_type text not null,
  status text not null default 'queued',
  provider text,
  model text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  attempt_count integer not null default 0,
  last_error text,
  next_retry_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint processing_jobs_card_owner_fk
    foreign key (card_id, user_id) references public.cards(id, user_id) on delete cascade,
  constraint processing_jobs_type_check check (job_type in ('upload', 'extraction', 'thumbnail', 'delete_assets')),
  constraint processing_jobs_status_check check (status in ('queued', 'uploading', 'processing', 'synced', 'failed', 'cancelled')),
  constraint processing_jobs_provider_check check (provider is null or provider in ('openai', 'gemini')),
  constraint processing_jobs_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint processing_jobs_result_object_check check (result is null or jsonb_typeof(result) = 'object'),
  constraint processing_jobs_attempt_count_check check (attempt_count >= 0)
);

-- Collection-scale lookup and search indexes.
create index cards_user_created_at_idx on public.cards (user_id, created_at desc);
create index cards_user_updated_at_idx on public.cards (user_id, updated_at desc);
create index cards_user_status_idx on public.cards (user_id, status, updated_at desc);
create index cards_user_favorite_idx on public.cards (user_id, updated_at desc) where is_favorite;
create index cards_user_company_idx on public.cards (user_id, lower(company)) where company is not null;
create index cards_user_source_hash_idx on public.cards (user_id, source_hash) where source_hash is not null;
create index cards_search_vector_idx on public.cards using gin (search_vector);
create index cards_display_name_trgm_idx on public.cards using gin (display_name extensions.gin_trgm_ops) where display_name is not null;
create index cards_company_trgm_idx on public.cards using gin (company extensions.gin_trgm_ops) where company is not null;

create index card_emails_user_normalized_idx on public.card_emails (user_id, normalized_email);
create unique index card_emails_one_primary_idx on public.card_emails (card_id) where is_primary;
create index card_phone_numbers_user_normalized_idx on public.card_phone_numbers (user_id, normalized_phone);
create unique index card_phone_numbers_one_primary_idx on public.card_phone_numbers (card_id) where is_primary;
create unique index card_websites_one_primary_idx on public.card_websites (card_id) where is_primary;
create unique index card_addresses_one_primary_idx on public.card_addresses (card_id) where is_primary;
create unique index tags_user_name_idx on public.tags (user_id, lower(btrim(name)));
create index card_tags_user_tag_idx on public.card_tags (user_id, tag_id, card_id);
create index card_images_user_card_idx on public.card_images (user_id, card_id);
create index processing_jobs_ready_idx on public.processing_jobs (user_id, status, next_retry_at, created_at)
  where status in ('queued', 'failed');

-- Keep mutable rows timestamped consistently.
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();
create trigger user_entitlements_set_updated_at before update on public.user_entitlements
for each row execute function public.set_updated_at();
create trigger cards_set_updated_at before update on public.cards
for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
for each row execute function public.set_updated_at();
create trigger processing_jobs_set_updated_at before update on public.processing_jobs
for each row execute function public.set_updated_at();

-- Provision one row in each account-scoped singleton table for new auth users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 120))
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Search main card data and normalized related fields while preserving RLS.
create or replace function public.search_cards(
  search_query text,
  page_size integer default 30,
  page_offset integer default 0
)
returns setof public.cards
language sql
stable
security invoker
set search_path = ''
as $$
  select c.*
  from public.cards as c
  where c.user_id = (select auth.uid())
    and c.status <> 'archived'
    and (
      nullif(btrim(search_query), '') is null
      or c.search_vector @@ websearch_to_tsquery('simple'::regconfig, search_query)
      or exists (
        select 1 from public.card_emails as email
        where email.card_id = c.id
          and email.user_id = c.user_id
          and email.normalized_email ilike '%' || lower(btrim(search_query)) || '%'
      )
      or exists (
        select 1 from public.card_phone_numbers as phone
        where phone.card_id = c.id
          and phone.user_id = c.user_id
          and phone.normalized_phone ilike '%' || regexp_replace(search_query, '[^0-9+]', '', 'g') || '%'
      )
      or exists (
        select 1
        from public.card_tags as card_tag
        join public.tags as tag on tag.id = card_tag.tag_id and tag.user_id = card_tag.user_id
        where card_tag.card_id = c.id
          and card_tag.user_id = c.user_id
          and tag.name ilike '%' || btrim(search_query) || '%'
      )
    )
  order by c.updated_at desc, c.id
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
$$;

-- RLS is mandatory for every user-owned table.
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.cards enable row level security;
alter table public.card_emails enable row level security;
alter table public.card_phone_numbers enable row level security;
alter table public.card_websites enable row level security;
alter table public.card_addresses enable row level security;
alter table public.tags enable row level security;
alter table public.card_tags enable row level security;
alter table public.card_images enable row level security;
alter table public.processing_jobs enable row level security;

create policy profiles_owner_all on public.profiles
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_preferences_owner_all on public.user_preferences
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_entitlements_owner_read on public.user_entitlements
for select to authenticated using ((select auth.uid()) = user_id);
create policy cards_owner_all on public.cards
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy card_emails_owner_all on public.card_emails
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy card_phone_numbers_owner_all on public.card_phone_numbers
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy card_websites_owner_all on public.card_websites
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy card_addresses_owner_all on public.card_addresses
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tags_owner_all on public.tags
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy card_tags_owner_all on public.card_tags
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy card_images_owner_all on public.card_images
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy processing_jobs_owner_all on public.processing_jobs
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Explicit Data API privileges. Anonymous clients receive no application data access.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select on public.user_entitlements to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
grant select, insert, update, delete on public.card_emails to authenticated;
grant select, insert, update, delete on public.card_phone_numbers to authenticated;
grant select, insert, update, delete on public.card_websites to authenticated;
grant select, insert, update, delete on public.card_addresses to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, update, delete on public.card_tags to authenticated;
grant select, insert, update, delete on public.card_images to authenticated;
grant select, insert, update, delete on public.processing_jobs to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.search_cards(text, integer, integer) from public, anon;
grant execute on function public.search_cards(text, integer, integer) to authenticated;

-- Private original-card image storage. Object paths are:
-- {user_id}/{card_id}/front.<ext> and {user_id}/{card_id}/back.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy cardnest_card_images_select
on storage.objects for select to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy cardnest_card_images_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy cardnest_card_images_update
on storage.objects for update to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy cardnest_card_images_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

comment on table public.cards is 'CardNest business-card records; one owner per row.';
comment on table public.card_images is 'Metadata for private original front/back card images.';
comment on table public.processing_jobs is 'Cloud-visible processing state; the durable device queue remains in Expo SQLite.';
comment on table public.user_entitlements is 'Server-managed, client-readable capability policy.';
