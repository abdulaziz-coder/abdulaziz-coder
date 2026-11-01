import { catalogSchema, receiptSchema, type Enquiry } from './schemas';

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    if (response.status === 409) throw new Error('This submission has changed. Please try again.');
    if (response.status === 422) throw new Error('Please check your details and try again.');
    throw new Error('The local admissions service is unavailable. Your details have not been confirmed as saved. You can retry or download a draft.');
  }
  return response.json();
}
export async function getStages() { return catalogSchema.parse(await request('/stages')); }
export async function submitEnquiry(data: Enquiry, id: string) {
  return receiptSchema.parse(await request('/enquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: JSON.stringify(data),
  }));
}
export async function getReceipt(id: string) { return receiptSchema.parse(await request(`/enquiries/${id}`)); }
