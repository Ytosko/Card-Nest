import { describe, expect, it } from 'vitest';
import { duplicateScore } from './duplicate-score';

const base = { display_name: 'Ada Lovelace', company: 'Analytical Engines', primary_email: 'ada@example.com', primary_phone: '+44 20 1234 5678' };
describe('duplicateScore', () => {
  it('flags matching normalized email and identity', () => expect(duplicateScore(base, { ...base, primary_phone: null })).toBeGreaterThanOrEqual(0.78));
  it('normalizes phone punctuation', () => expect(duplicateScore(base, { ...base, primary_email: null, primary_phone: '+44 (20) 1234-5678' })).toBeGreaterThanOrEqual(0.78));
  it('does not flag a shared company alone', () => expect(duplicateScore(base, { display_name: 'Grace Hopper', company: base.company, primary_email: null, primary_phone: null })).toBeLessThan(0.5));
});
