import { z } from 'zod';

const identity = z.object({ username: z.string() });
const detail = z.object({ id: z.uuid(), reference: z.string().regex(/^BM-\d{6,}$/), name: z.string(), email: z.string(), phone: z.string().nullable(), grade: z.number().nullable(), message: z.string(), created_at: z.string(), status: z.enum(['new', 'received', 'ready_for_review']), received_at: z.string().nullable() });
const pageSchema = z.object({ items: z.array(detail), total: z.number(), page: z.number(), page_size: z.number(), stats: z.object({ total: z.number(), received: z.number(), ready_for_review: z.number() }) });
export type AdminEnquiry = z.infer<typeof detail>;
export class AdminError extends Error { constructor(public status: number, message: string) { super(message); } }

async function request(path: string, options?: RequestInit) {
  let response: Response;
  try { response = await fetch(`/api/admin${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10_000) }); }
  catch { throw new AdminError(503, 'The local admin service is unavailable. Please check that the backend is running.'); }
  if (!response.ok) {
    const messages: Record<number, string> = { 401: path === '/login' ? 'Incorrect username or password.' : 'Please sign in again.', 429: 'Too many sign-in attempts. Try again in a minute.', 503: path === '/login' ? 'Admin account is not configured. Run the local database initializer.' : 'The local admin service is unavailable. Please check that the backend is running.' };
    throw new AdminError(response.status, messages[response.status] ?? 'The local admin service is unavailable. Please check that the backend is running.');
  }
  return response.status === 204 ? null : response.json();
}
export async function adminSession() {
  try { return identity.parse(await request('/session')); }
  catch (error) { if (error instanceof AdminError && error.status === 401) return null; throw error; }
}
export async function adminLogin(username: string, password: string) { return identity.parse(await request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })); }
export async function adminLogout() { await request('/logout', { method: 'POST' }); }
export async function adminEnquiries(filters: { q: string; grade: string; status: string; page: number }) {
  const params = new URLSearchParams({ page: String(filters.page), page_size: '25' });
  if (filters.q) params.set('q', filters.q);
  if (filters.grade) params.set('grade', filters.grade);
  if (filters.status) params.set('status', filters.status);
  return pageSchema.parse(await request(`/enquiries?${params}`));
}
export async function markEnquiryReceived(id: string) {
  return detail.parse(await request(`/enquiries/${id}/received`, { method: 'PATCH' }));
}
export async function deleteEnquiry(id: string) {
  await request(`/enquiries/${id}`, { method: 'DELETE' });
}
