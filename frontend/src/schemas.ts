import { z } from 'zod';

export const stageSchema = z.enum(['Primary school', 'Secondary school', 'Not sure yet']);
export const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter at least two characters.').max(120),
  email: z.email('Please enter a valid email address.').max(200),
  grade: z.number().int().min(1).max(11),
  message: z.string().trim().max(3000, 'Please keep your message under 3,000 characters.'),
  consent: z.literal(true, { error: 'Please agree to save this enquiry locally.' }),
});
export type Enquiry = z.infer<typeof enquirySchema>;
export const receiptSchema = z.object({
  id: z.uuid(), status: z.enum(['received', 'ready_for_review']), created_at: z.string(),
});
export const catalogSchema = z.array(z.object({
  id: z.string(), name: stageSchema, eyebrow: z.string(), title: z.string(), description: z.string(),
  highlights: z.array(z.string()),
}));
export type Stage = z.infer<typeof catalogSchema>[number];
export const previewStages: Stage[] = [
  { id: 'primary', name: 'Primary school', eyebrow: 'GROWING CONFIDENCE', title: 'Connect ideas. Find your spark.', description: 'Connecting ideas, building friendships, and discovering the confidence to try. A vision for curious learners ready to explore.', highlights: ['Creative thinking', 'Growing independence', 'Meaningful connections'] },
  { id: 'secondary', name: 'Secondary school', eyebrow: 'WIDER HORIZONS', title: 'Your ideas can go further.', description: 'Thinking independently, finding purpose, and imagining what comes next. A proposed journey toward a wider world.', highlights: ['Independent thinking', 'Finding purpose', 'Wider perspectives'] },
];
