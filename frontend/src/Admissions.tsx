import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { enquirySchema, stageSchema, type Enquiry } from './schemas';
import { getReceipt, submitEnquiry } from './api';

export default function Admissions({ stage, setStage }: { stage: string; setStage: (value: string) => void }) {
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState({ name: '', email: '', message: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submission = useRef<{ id: string; body: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mutation = useMutation({ mutationFn: ({ data, id }: { data: Enquiry; id: string }) => submitEnquiry(data, id), retry: false });
  const receipt = useQuery({
    queryKey: ['receipt', mutation.data?.id], queryFn: () => getReceipt(mutation.data!.id),
    enabled: !!mutation.data, staleTime: 0, retry: false,
    refetchInterval: query => query.state.data?.status === 'ready_for_review' || query.state.error ? false : 3000,
  });
  function move(next: number) { setStep(next); setTimeout(() => heading.current?.focus(), 0); }
  function validate() {
    const result = enquirySchema.safeParse({ ...fields, stage });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return null;
    }
    setErrors({}); return result.data;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const data = validate(); if (!data) return;
    if (step === 0) { move(1); return; }
    const body = JSON.stringify(data);
    if (!submission.current || submission.current.body !== body) submission.current = { id: crypto.randomUUID(), body };
    mutation.mutate({ data, id: submission.current.id });
  }
  function download() {
    const text = `Boborahim Mashrab International School — Local draft (not submitted)\n\nName: ${fields.name}\nEmail: ${fields.email}\nStage: ${stage}\n\n${fields.message}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'BM-school-enquiry-draft.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const status = receipt.data?.status ?? mutation.data?.status;
  return <section className="admissions section" id="admissions">
    <div><p className="eyebrow">A BIG FUTURE STARTS WITH A HELLO</p><h2>Let’s write<br /><em>your next chapter.</em></h2><p>Tell us a little about your family.<br />We’ll help you take the first step.</p><div className="mt-8 flex gap-3" aria-label="Enquiry progress">{['Your details', 'Review', 'Saved'].map((label, index) => <span key={label} className={`rounded-full px-3 py-2 text-xs ${index === (mutation.isSuccess ? 2 : step) ? 'bg-white text-brand' : 'bg-white/10 text-white/70'}`}>{index + 1}. {label}</span>)}</div><p className="mt-6 text-xs!">Local development: enquiries are stored on this computer. No email is sent to the school.</p></div>
    <div className="min-w-0"><AnimatePresence mode="wait">
      {mutation.isSuccess ? <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} role="status" className="rounded-3xl border border-white/20 bg-white/10 p-7"><span className="text-4xl" aria-hidden="true">✓</span><h3 className="mt-4 text-3xl! text-white">Your enquiry is saved.</h3><p className="mt-4 text-sm leading-7">{status === 'ready_for_review' ? 'Your enquiry is ready for review in the local system.' : 'Saved to the local database. Waiting for the background workflow to prepare it for review.'}</p><p className="mt-4 break-all text-xs text-white/70">Reference: {mutation.data.id}</p>{receipt.isError && <p className="mt-4 text-xs">Status updates are unavailable. Your enquiry was saved; please keep your reference.</p>}<button type="button" className="button mt-7" onClick={() => { mutation.reset(); submission.current = null; setFields({ name: '', email: '', message: '', consent: false }); setStage(''); move(0); }}>Prepare another enquiry ↗</button></motion.div> :
      <motion.form key={step} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} onSubmit={submit} noValidate>
        <h3 ref={heading} tabIndex={-1} className="mb-6 text-2xl! text-white">{step === 0 ? 'A little about you' : 'Everything look right?'}</h3>
        {step === 0 ? <><div className="form-row">{(['name', 'email'] as const).map(field => <label key={field} htmlFor={field}>{field === 'name' ? 'Parent or guardian’s name' : 'Email address'}<input id={field} autoComplete={field} type={field === 'email' ? 'email' : 'text'} value={fields[field]} maxLength={field === 'name' ? 120 : 200} onChange={e => setFields({ ...fields, [field]: e.target.value })} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined} required />{errors[field] && <span id={`${field}-error`} className="field-error">{errors[field]}</span>}</label>)}</div>
        <label htmlFor="stage">Stage of interest<select id="stage" value={stage} onChange={e => setStage(e.target.value)} required aria-invalid={!!errors.stage} aria-describedby={errors.stage ? 'stage-error' : undefined}><option value="">Choose a learning stage</option>{stageSchema.options.map(value => <option key={value}>{value}</option>)}</select>{errors.stage && <span id="stage-error" className="field-error">Choose a learning stage.</span>}</label>
        <label htmlFor="message">What would you like to know?<textarea id="message" rows={3} maxLength={3000} value={fields.message} onChange={e => setFields({ ...fields, message: e.target.value })} />{errors.message && <span className="field-error">{errors.message}</span>}</label>
        <label className="consent-label"><input type="checkbox" checked={fields.consent} onChange={e => setFields({ ...fields, consent: e.target.checked })} aria-describedby={errors.consent ? 'consent-error' : undefined} />I agree to save these details in the local admissions database.</label>{errors.consent && <p className="field-error" id="consent-error">{errors.consent}</p>}</> : <><dl className="review-grid">{Object.entries({ Name: fields.name, Email: fields.email, Stage: stage, Message: fields.message || 'No additional message' }).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p className="form-note">Submitting saves your enquiry to the local PostgreSQL database. A background workflow prepares it for review.</p></>}
        {Object.keys(errors).length > 0 && <p role="alert" className="field-error">Please check the highlighted fields above.</p>}
        {mutation.isError && <p role="alert" className="field-error">{mutation.error.message}</p>}
        <div className="flex flex-wrap items-center gap-4"><button type="submit" className="button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : step === 0 ? 'Review my enquiry' : 'Save my enquiry'} <span>↗</span></button>{step === 1 && <button type="button" className="text-link text-white" disabled={mutation.isPending} onClick={() => { mutation.reset(); move(0); }}>Edit details</button>}<button type="button" className="text-link text-white/80" onClick={download}>Download draft ↓</button></div>
      </motion.form>}
    </AnimatePresence></div>
  </section>;
}
