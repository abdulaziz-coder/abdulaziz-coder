import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { languages, translate, type Locale } from './translations';
import LanguageFlag from './LanguageFlag';

const STORAGE_KEY = 'bm-school-language';
export function readSavedLocale(): Locale {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved === 'en' || saved === 'uz' || saved === 'ru') return saved; } catch { /* Storage is optional. */ }
  return 'uz';
}
const LanguageContext = createContext({ locale: 'uz' as Locale, setLocale: (_locale: Locale) => {}, t: (text: string) => translate('uz', text) });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readSavedLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${translate(locale, 'Boborahim Mashrab International School')} — ${translate(locale, 'A world of possibility.')}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${translate(locale, 'Boborahim Mashrab International School')}. ${translate(locale, 'A world of possibility.')}`);
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* Private browsing may disable storage. */ }
  }, [locale]);
  return <LanguageContext.Provider value={{ locale, setLocale, t: text => translate(locale, text) }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (open) options.current[languages.findIndex(language => language.code === locale)]?.focus();
  }, [open, locale]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  function navigate(event: KeyboardEvent) {
    const index = options.current.findIndex(option => option === document.activeElement);
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = (index + 1) % languages.length;
    if (event.key === 'ArrowUp') next = (index - 1 + languages.length) % languages.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = languages.length - 1;
    if (next !== undefined) { event.preventDefault(); options.current[next]?.focus(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'Tab') setOpen(false);
  }
  return <div className="language-switcher" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button className="language-trigger" ref={trigger} type="button" aria-label={`${t('Language')}: ${languages.find(language => language.code === locale)!.label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } if (event.key === 'Escape') close(); }}>
      <LanguageFlag locale={locale} /><span>{locale.toUpperCase()}</span><motion.svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduced ? 0 : .18 }}><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></motion.svg>
    </button>
    <AnimatePresence>{open && <motion.div id={id} className="language-menu" role="menu" aria-label={t('Language')} inert={!open} initial={{ opacity: 0, y: reduced ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={{ duration: reduced ? 0 : .16 }} onKeyDown={navigate}>
      <span className="language-menu-heading">{t('Language')}</span>
      {languages.map((language, index) => <button key={language.code} ref={element => { options.current[index] = element; }} type="button" role="menuitemradio" aria-checked={locale === language.code} tabIndex={-1} className="language-option" onClick={() => { setLocale(language.code); close(); }}>
        <LanguageFlag locale={language.code} /><span lang={language.code}>{language.label}</span><span className="language-option-code">{locale === language.code ? '✓' : language.short}</span>
      </button>)}
    </motion.div>}</AnimatePresence>
  </div>;
}
