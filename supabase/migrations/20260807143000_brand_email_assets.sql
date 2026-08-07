-- Public, immutable presentation assets used by transactional email clients.
-- Original card images remain in the separate private card-images bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 1048576, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No client write policy is intentionally created. Uploads are admin-tooling only.
