-- Add messaging and payment service metadata columns to card_phone_numbers
alter table public.card_phone_numbers
  add column if not exists service text,
  add column if not exists service_label text;

-- Relax label constraint on card_phone_numbers to support flexible phone types (office, direct, landline, mobile, etc.)
alter table public.card_phone_numbers
  drop constraint if exists card_phone_numbers_label_check;

comment on column public.card_phone_numbers.service is 'Service identifier (whatsapp, imo, bkash, telegram, viber, line, wechat, signal, messenger, nagad, rocket, other)';
comment on column public.card_phone_numbers.service_label is 'Human-readable service label (e.g. WhatsApp, bKash, Nagad, IMO)';
