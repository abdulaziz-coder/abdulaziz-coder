import { describe, expect, it } from 'vitest';
import { enquirySchema, receiptSchema } from './schemas';

const valid = { name: '  Alex Parent  ', email: 'parent@example.com', phone: '+998 90 123 45 67', grade: 1, message: '', consent: true };
describe('admissions contract', () => {
  it('trims names and accepts a valid enquiry', () => expect(enquirySchema.parse(valid).name).toBe('Alex Parent'));
  it('normalizes a formatted phone number', () => expect(enquirySchema.parse(valid).phone).toBe('+998901234567'));
  it.each(['', '12345', '+1234567890123456', 'call me', '++998901234567', undefined])('rejects invalid or missing phone %s', phone => expect(enquirySchema.safeParse({ ...valid, phone }).success).toBe(false));
  it.each([1, 11])('accepts boundary grade %i', grade => expect(enquirySchema.parse({ ...valid, grade }).grade).toBe(grade));
  it.each([0, 12, 1.5, undefined, '5'])('rejects invalid or missing grade %s', grade => expect(enquirySchema.safeParse({ ...valid, grade }).success).toBe(false));
  it.each([
    { email: 'invalid' }, { consent: false }, { name: ' ' }, { message: 'a'.repeat(3001) },
  ])('rejects invalid or unconsented enquiry %#', patch => expect(enquirySchema.safeParse({ ...valid, ...patch }).success).toBe(false));
  it('rejects unrecognized server statuses', () => expect(receiptSchema.safeParse({ id: '7ea2a2e4-f086-43db-a032-a59ef8df7659', reference: 'BM-000001', status: 'emailed', created_at: '2026-11-01' }).success).toBe(false));
  it('accepts a short reference while retaining the internal UUID', () => expect(receiptSchema.parse({ id: '7ea2a2e4-f086-43db-a032-a59ef8df7659', reference: 'BM-000001', status: 'received', created_at: '2026-11-01' }).reference).toBe('BM-000001'));
});
