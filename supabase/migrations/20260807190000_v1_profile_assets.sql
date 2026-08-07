-- CardNest v1 profile media foundation.
-- User-facing branding is Card Nest; technical identifiers remain unchanged.

alter table public.profiles
add column avatar_path text;

alter table public.profiles
add constraint profiles_avatar_path_length
check (avatar_path is null or char_length(avatar_path) between 1 and 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy cardnest_profile_avatars_select
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy cardnest_profile_avatars_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy cardnest_profile_avatars_update
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy cardnest_profile_avatars_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

comment on column public.profiles.avatar_path is
'Private profile-avatars object path. Signed URLs are created on demand.';
