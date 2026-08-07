import type { Card } from '@/src/types/database.helpers';

const lettersAndNumbers = (value?: string | null) => (value ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const phone = (value?: string | null) => (value ?? '').replace(/[^0-9+]+/gu, '');

export function duplicateScore(candidate: Pick<Card, 'display_name' | 'company' | 'primary_email' | 'primary_phone'>, existing: Pick<Card, 'display_name' | 'company' | 'primary_email' | 'primary_phone'>) {
  let score = 0;
  const emailA = candidate.primary_email?.trim().toLowerCase(); const emailB = existing.primary_email?.trim().toLowerCase();
  if (emailA && emailB && emailA === emailB) score += 0.7;
  const phoneA = phone(candidate.primary_phone); const phoneB = phone(existing.primary_phone);
  if (phoneA && phoneB && phoneA === phoneB) score += 0.65;
  const nameA = lettersAndNumbers(candidate.display_name); const nameB = lettersAndNumbers(existing.display_name);
  if (nameA && nameB && nameA === nameB) score += 0.25;
  const companyA = lettersAndNumbers(candidate.company); const companyB = lettersAndNumbers(existing.company);
  if (companyA && companyB && companyA === companyB) score += 0.15;
  return Math.min(score, 1);
}
