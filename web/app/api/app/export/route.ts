import { NextResponse } from 'next/server';

import { contactName, getWebContacts } from '@/lib/contacts';

function csvCell(value: unknown) { return `"${String(value ?? '').replace(/"/gu, '""')}"`; }
function vcardEscape(value: unknown) { return String(value ?? '').replace(/\\/gu, '\\\\').replace(/;/gu, '\\;').replace(/,/gu, '\\,').replace(/\r?\n/gu, '\\n'); }

export async function GET(request: Request) {
  const url = new URL(request.url); const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'vcard';
  const ids = new Set((url.searchParams.get('ids') ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/iu.test(id)));
  const all = await getWebContacts(); const contacts = ids.size ? all.filter((item) => ids.has(item.id)) : all;
  if (format === 'csv') {
    const headers = ['Name','First name','Last name','Company','Job title','Emails','Phones','Websites','Address','Tags','Notes'];
    const rows = contacts.map((contact) => [contactName(contact),contact.first_name,contact.last_name,contact.company,contact.job_title,contact.card_emails.map((item) => item.email).join('; '),contact.card_phone_numbers.map((item) => item.phone_number).join('; '),contact.card_websites.map((item) => item.url).join('; '),[contact.address_line_1,contact.address_line_2,contact.city,contact.state_region,contact.postal_code,contact.country].filter(Boolean).join(', '),contact.card_tags.map((item) => item.tags?.name).filter(Boolean).join('; '),contact.notes].map(csvCell).join(','));
    return new NextResponse(`\uFEFF${headers.map(csvCell).join(',')}\r\n${rows.join('\r\n')}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="Card-Nest-contacts.csv"', 'Cache-Control': 'private, no-store' } });
  }
  const cards = contacts.map((contact) => ['BEGIN:VCARD','VERSION:3.0',`FN:${vcardEscape(contactName(contact))}`,`N:${vcardEscape(contact.last_name)};${vcardEscape(contact.first_name)};${vcardEscape(contact.middle_name)};;`,contact.company ? `ORG:${vcardEscape(contact.company)}` : '',contact.job_title ? `TITLE:${vcardEscape(contact.job_title)}` : '',...contact.card_emails.map((item) => `EMAIL;TYPE=${vcardEscape(item.label).toUpperCase()}:${vcardEscape(item.email)}`),...contact.card_phone_numbers.map((item) => `TEL;TYPE=${vcardEscape(item.label).toUpperCase()}:${vcardEscape(item.phone_number)}`),...contact.card_websites.map((item) => `URL:${vcardEscape(item.url)}`),contact.notes ? `NOTE:${vcardEscape(contact.notes)}` : '','END:VCARD'].filter(Boolean).join('\r\n')).join('\r\n');
  return new NextResponse(cards, { headers: { 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': 'attachment; filename="Card-Nest-contacts.vcf"', 'Cache-Control': 'private, no-store' } });
}
