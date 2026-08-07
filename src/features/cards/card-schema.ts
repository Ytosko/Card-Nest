import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default('');

export const emailItemSchema = z.object({
  id: z.string().optional(),
  email: z.string().trim().default(''),
  label: z.string().trim().default('Work'),
  isPrimary: z.boolean().default(false),
});

export const phoneItemSchema = z.object({
  id: z.string().optional(),
  phone: z.string().trim().default(''),
  label: z.string().trim().default('Mobile'),
  isPrimary: z.boolean().default(false),
});

export type EmailItem = z.infer<typeof emailItemSchema>;
export type PhoneItem = z.infer<typeof phoneItemSchema>;

export const cardDraftSchema = z
  .object({
    firstName: optionalText(120),
    middleName: optionalText(120),
    lastName: optionalText(120),
    displayName: optionalText(240),
    company: optionalText(240),
    jobTitle: optionalText(240),
    department: optionalText(240),
    email: z.union([z.literal(''), z.string().email('Enter a valid email address.')]).default(''),
    phone: optionalText(80),
    fax: optionalText(80),
    emails: z.array(emailItemSchema).default([]),
    phones: z.array(phoneItemSchema).default([]),
    website: z.union([z.literal(''), z.string().url('Enter a complete website address, including https://')]).default(''),
    addressLine1: optionalText(240),
    addressLine2: optionalText(240),
    city: optionalText(120),
    stateRegion: optionalText(120),
    postalCode: optionalText(40),
    country: optionalText(120),
    notes: optionalText(4_000),
    rawText: optionalText(10_000),
  })
  .refine(
    (value) => Boolean(value.displayName || value.firstName || value.lastName || value.company),
    { message: 'Add a name or company so you can find this contact later.', path: ['displayName'] }
  );

export type CardDraft = z.infer<typeof cardDraftSchema>;

export const emptyCardDraft: CardDraft = {
  firstName: '',
  middleName: '',
  lastName: '',
  displayName: '',
  company: '',
  jobTitle: '',
  department: '',
  email: '',
  phone: '',
  fax: '',
  emails: [{ email: '', label: 'Work', isPrimary: true }],
  phones: [{ phone: '', label: 'Mobile', isPrimary: true }],
  website: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  country: '',
  notes: '',
  rawText: '',
};

export function displayNameForDraft(draft: CardDraft) {
  return (
    draft.displayName ||
    [draft.firstName, draft.middleName, draft.lastName].filter(Boolean).join(' ') ||
    draft.company
  );
}
