import { catalogSchema, receiptSchema, type Enquiry } from './schemas';

export class ApiError extends Error {}

async function request(path: string, options?: RequestInit) {
  const response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    if (response.status === 409) throw new ApiError('This submission has changed. Please try again.');
    if (response.status === 422) throw new ApiError('Please check your details and try again.');
    throw new ApiError('The local admissions service is unavailable. Your details have not been confirmed as saved. You can retry or download a draft.');
  }
  return response.json();
}
export async function getStages() {
  const data = await request('/stages');
  // Ignore the retired stage if an older local API is still running during an update.
  return catalogSchema.parse(Array.isArray(data) ? data.filter(stage => stage?.id !== 'early') : data);
}
export async function submitEnquiry(data: Enquiry, id: string) {
  return receiptSchema.parse(await request('/enquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: JSON.stringify(data),
  }));
}
export async function getReceipt(id: string) { return receiptSchema.parse(await request(`/enquiries/${id}`)); }
