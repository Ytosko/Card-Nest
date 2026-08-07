import { z } from 'zod';

export const extractedCardSchema = z.object({
  displayName: z.string().default(''), firstName: z.string().default(''), middleName: z.string().default(''), lastName: z.string().default(''),
  company: z.string().default(''), jobTitle: z.string().default(''), department: z.string().default(''),
  emails: z.array(z.string()).default([]), phones: z.array(z.string()).default([]), websites: z.array(z.string()).default([]),
  addressLine1: z.string().default(''), addressLine2: z.string().default(''), city: z.string().default(''), stateRegion: z.string().default(''), postalCode: z.string().default(''), country: z.string().default(''),
  notes: z.string().default(''), rawText: z.string().default(''), confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedCard = z.infer<typeof extractedCardSchema>;
