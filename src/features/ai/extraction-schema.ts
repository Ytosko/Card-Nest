import { z } from 'zod';

export const extractedPhoneItemSchema = z.union([
  z.string().transform((val) => ({
    number: val,
    label: 'Mobile',
    service: '',
    serviceLabel: '',
    isPrimary: false,
  })),
  z
    .object({
      number: z.string().optional().default(''),
      phone: z.string().optional().default(''),
      label: z.string().optional().default('Mobile'),
      service: z.string().optional().default(''),
      serviceLabel: z.string().optional().default(''),
      isPrimary: z.boolean().optional().default(false),
    })
    .transform((val) => ({
      number: val.number || val.phone || '',
      label: val.label || 'Mobile',
      service: val.service || '',
      serviceLabel: val.serviceLabel || '',
      isPrimary: Boolean(val.isPrimary),
    })),
]);

export const extractedEmailItemSchema = z.union([
  z.string().transform((val) => ({
    email: val,
    label: 'Work',
    isPrimary: false,
  })),
  z
    .object({
      email: z.string().optional().default(''),
      label: z.string().optional().default('Work'),
      isPrimary: z.boolean().optional().default(false),
    })
    .transform((val) => ({
      email: val.email || '',
      label: val.label || 'Work',
      isPrimary: Boolean(val.isPrimary),
    })),
]);

export type ExtractedPhoneItem = z.infer<typeof extractedPhoneItemSchema>;
export type ExtractedEmailItem = z.infer<typeof extractedEmailItemSchema>;

export const extractedCardSchema = z.object({
  displayName: z.string().default(''),
  firstName: z.string().default(''),
  middleName: z.string().default(''),
  lastName: z.string().default(''),
  company: z.string().default(''),
  jobTitle: z.string().default(''),
  department: z.string().default(''),
  emails: z.array(extractedEmailItemSchema).default([]),
  phones: z.array(extractedPhoneItemSchema).default([]),
  websites: z.array(z.string()).default([]),
  addressLine1: z.string().default(''),
  addressLine2: z.string().default(''),
  city: z.string().default(''),
  stateRegion: z.string().default(''),
  postalCode: z.string().default(''),
  country: z.string().default(''),
  notes: z.string().default(''),
  rawText: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedCard = z.infer<typeof extractedCardSchema>;
