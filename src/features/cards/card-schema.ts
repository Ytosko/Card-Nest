import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default('');

export const cardDraftSchema = z
  .object({
    firstName: optionalText(120),
    middleName: optionalText(120),
    lastName: optionalText(120),
    displayName: optionalText(240),
    company: optionalText(240),
    jobTitle: optionalText(240),
    department: optionalText(240),
    email: z.union([z.literal(''), z.email('Enter a valid email address.')]).default(''),
    phone: optionalText(80),
    website: z.union([z.literal(''), z.url('Enter a complete website address, including https://')]).default(''),
    addressLine1: optionalText(240),
    addressLine2: optionalText(240),
    city: optionalText(120),
    stateRegion: optionalText(120),
    postalCode: optionalText(40),
    country: optionalText(120),
    notes: optionalText(4_000),
  })
  .refine(
    (value) => Boolean(value.displayName || value.firstName || value.lastName || value.company),
    { message: 'Add a name or company so you can find this card later.', path: ['displayName'] },
  );

export type CardDraft = z.infer<typeof cardDraftSchema>;

export const emptyCardDraft: CardDraft = {
  firstName: '', middleName: '', lastName: '', displayName: '', company: '', jobTitle: '', department: '',
  email: '', phone: '', website: '', addressLine1: '', addressLine2: '', city: '', stateRegion: '',
  postalCode: '', country: '', notes: '',
};

export function displayNameForDraft(draft: CardDraft) {
  return draft.displayName || [draft.firstName, draft.middleName, draft.lastName].filter(Boolean).join(' ') || draft.company;
}
