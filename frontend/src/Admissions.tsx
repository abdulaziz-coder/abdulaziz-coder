import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { enquirySchema, type Enquiry } from './schemas';
import { getReceipt, submitEnquiry, ApiError } from './api';
import { useLanguage } from './i18n';

export default function Admissions() {
  const { t, locale } = useLanguage();
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState({ name: '', email: '', phone: '', grade: '', message: '', consent: false });
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
    const result = enquirySchema.safeParse({ ...fields, grade: Number(fields.grade) });
    if (!result.success) {
      const messages: Record<string, string> = {
        name: 'Please enter a name between 2 and 120 characters.', email: 'Please enter a valid email address.', phone: 'Please enter a valid phone number with 7 to 15 digits.',
        grade: 'Choose a grade from 1 to 11.', message: 'Please keep your message under 3,000 characters.',
        consent: 'Please agree to save this enquiry locally.',
      };
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), messages[String(issue.path[0])]])));
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
    const text = `${t('Boborahim Mashrab International School')} — ${t('Local draft (not submitted)')}\n\n${t('Name')}: ${fields.name}\n${t('Email')}: ${fields.email}\n${t('Phone number')}: ${fields.phone}\n${t('Grade')}: ${fields.grade}\n\n${fields.message}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `Boborahim-Mashrab-enquiry-${locale}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const status = receipt.data?.status ?? mutation.data?.status;
  return <section className="admissions section" id="admissions">
    <div><p className="eyebrow">{t("A BIG FUTURE STARTS WITH A HELLO")}</p><h2>{t("Let’s write")}<br /><em>{t("your next chapter.")}</em></h2><p>{t("Tell us a little about your family.")}<br />{t("We’ll help you take the first step.")}</p><div className="mt-8 flex gap-3" aria-label={t("Enquiry progress")}>{['Your details', 'Review', 'Saved'].map((label, index) => <span key={index} className={`rounded-full px-3 py-2 text-xs ${index === (mutation.isSuccess ? 2 : step) ? 'bg-white text-brand' : 'bg-white/10 text-white/70'}`}>{index + 1}. {t(label)}</span>)}</div><p className="mt-6 text-xs!">{t("Local development: enquiries are stored on this computer. No email is sent to the school.")}</p></div>
    <div className="min-w-0"><AnimatePresence mode="wait">
      {mutation.isSuccess ? <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} role="status" className="rounded-3xl border border-white/20 bg-white/10 p-7"><span className="text-4xl" aria-hidden="true">✓</span><h3 className="mt-4 text-3xl! text-white">{t("Your enquiry is saved.")}</h3><p className="mt-4 text-sm leading-7">{t(status === 'ready_for_review' ? 'Your enquiry is ready for review in the local system.' : 'Saved to the local database. Waiting for the background workflow to prepare it for review.')}</p><p className="mt-4 break-all text-xs text-white/70">{t("Reference")}: {mutation.data.reference}</p>{receipt.isError && <p className="mt-4 text-xs">{t("Status updates are unavailable. Your enquiry was saved; please keep your reference.")}</p>}<button type="button" className="button mt-7" onClick={() => { mutation.reset(); submission.current = null; setFields({ name: '', email: '', phone: '', grade: '', message: '', consent: false }); move(0); }}>{t("Prepare another enquiry")} ↗</button></motion.div> :
      <motion.form key={step} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} onSubmit={submit} noValidate>
        <h3 ref={heading} tabIndex={-1} className="mb-6 text-2xl! text-white">{t(step === 0 ? 'A little about you' : 'Everything look right?')}</h3>
        <p className="form-note">{t('Our school accepts students in Grades 1–11 only.')}</p>
        {step === 0 ? <><div className="form-row">{(['name', 'email'] as const).map(field => <label key={field} htmlFor={field}>{t(field === 'name' ? 'Parent or guardian’s name' : 'Email address')}<input id={field} autoComplete={field} type={field === 'email' ? 'email' : 'text'} value={fields[field]} maxLength={field === 'name' ? 120 : 200} onChange={e => setFields({ ...fields, [field]: e.target.value })} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined} required />{errors[field] && <span id={`${field}-error`} className="field-error">{t(errors[field])}</span>}</label>)}</div>
        <div className="form-row"><label htmlFor="phone"><span id="phone-label">{t('Phone number')}</span><input id="phone" aria-labelledby="phone-label" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" maxLength={32} value={fields.phone} onChange={event => setFields({ ...fields, phone: event.target.value })} required aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-hint phone-error' : 'phone-hint'} /><span className="phone-hint" id="phone-hint">{t('Include your country code, for example +998.')}</span>{errors.phone && <span id="phone-error" className="field-error">{t(errors.phone)}</span>}</label>
        <label htmlFor="grade">{t('Grade')}<select id="grade" value={fields.grade} onChange={event => setFields({ ...fields, grade: event.target.value })} required aria-invalid={!!errors.grade} aria-describedby={errors.grade ? 'grade-error' : undefined}><option value="" disabled hidden>{t('Choose a grade')}</option>{Array.from({ length: 11 }, (_, index) => index + 1).map(grade => <option key={grade} value={grade}>{locale === 'uz' ? `${grade}-sinf` : locale === 'ru' ? `${grade} класс` : `Grade ${grade}`}</option>)}</select>{errors.grade && <span id="grade-error" className="field-error">{t(errors.grade)}</span>}</label></div>
        <label htmlFor="message">{t("What would you like to know?")}<textarea id="message" rows={3} maxLength={3000} value={fields.message} onChange={e => setFields({ ...fields, message: e.target.value })} />{errors.message && <span className="field-error">{t(errors.message)}</span>}</label>
        <label className="consent-label"><input type="checkbox" checked={fields.consent} onChange={e => setFields({ ...fields, consent: e.target.checked })} aria-describedby={errors.consent ? 'consent-error' : undefined} />{t("I agree to save these details in the local admissions database.")}</label>{errors.consent && <p className="field-error" id="consent-error">{t(errors.consent)}</p>}</> : <><dl className="review-grid">{Object.entries({ Name: fields.name, Email: fields.email, 'Phone number': fields.phone, Grade: fields.grade, Message: fields.message || 'No additional message' }).map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>{key === 'Message' && !fields.message ? t('No additional message') : value}</dd></div>)}</dl><p className="form-note">{t("Submitting saves your enquiry to the local PostgreSQL database. A background workflow prepares it for review.")}</p></>}
        {Object.keys(errors).length > 0 && <p role="alert" className="field-error">{t("Please check the highlighted fields above.")}</p>}
        {mutation.isError && <p role="alert" className="field-error">{t(mutation.error instanceof ApiError ? mutation.error.message : 'Something went wrong. Please try again or download a draft.')}</p>}
        <div className="flex flex-wrap items-center gap-4"><button type="submit" className="button" disabled={mutation.isPending}>{t(mutation.isPending ? 'Saving…' : step === 0 ? 'Review my enquiry' : 'Save my enquiry')} <span>↗</span></button>{step === 1 && <button type="button" className="text-link text-white" disabled={mutation.isPending} onClick={() => { mutation.reset(); move(0); }}>{t("Edit details")}</button>}<button type="button" className="text-link text-white/80" onClick={download}>{t("Download draft")} ↓</button></div>
      </motion.form>}
    </AnimatePresence></div>
  </section>;
}
