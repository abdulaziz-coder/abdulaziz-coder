import { describe, expect, it } from 'vitest';
import { enquirySchema, receiptSchema } from './schemas';

const valid = { name: '  Alex Parent  ', email: 'parent@example.com', grade: 1, message: '', consent: true };
describe('admissions contract', () => {
  it('trims names and accepts a valid enquiry', () => expect(enquirySchema.parse(valid).name).toBe('Alex Parent'));
  it.each([1, 11])('accepts boundary grade %i', grade => expect(enquirySchema.parse({ ...valid, grade }).grade).toBe(grade));
  it.each([0, 12, 1.5, undefined, '5'])('rejects invalid or missing grade %s', grade => expect(enquirySchema.safeParse({ ...valid, grade }).success).toBe(false));
  it.each([
    { email: 'invalid' }, { consent: false }, { name: ' ' }, { message: 'a'.repeat(3001) },
  ])('rejects invalid or unconsented enquiry %#', patch => expect(enquirySchema.safeParse({ ...valid, ...patch }).success).toBe(false));
  it('rejects unrecognized server statuses', () => expect(receiptSchema.safeParse({ id: '7ea2a2e4-f086-43db-a032-a59ef8df7659', status: 'emailed', created_at: '2026-11-01' }).success).toBe(false));
});
