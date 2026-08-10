export type WebContact = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  department: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  raw_extracted_text: string | null;
  contact_photo_path: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  card_emails: { id: string; email: string; label: string; is_primary: boolean }[];
  card_phone_numbers: { id: string; phone_number: string; label: string; service: string | null; service_label: string | null; is_primary: boolean }[];
  card_websites: { id: string; url: string; label: string; is_primary: boolean }[];
  card_addresses: { id: string; label: string; address_line_1: string | null; address_line_2: string | null; city: string | null; state_region: string | null; postal_code: string | null; country: string | null; is_primary: boolean }[];
  card_images: { id: string; side: string; storage_path: string; mime_type: string }[];
  card_tags: { tags: { id: string; name: string; color: string | null } | null }[];
  avatar_url?: string | null;
};

export function contactName(contact: Pick<WebContact, 'display_name' | 'first_name' | 'last_name' | 'company'>) {
  return contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.company || 'Unnamed contact';
}
