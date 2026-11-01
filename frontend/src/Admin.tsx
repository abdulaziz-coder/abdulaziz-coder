import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import Brand from './Brand';
import { LanguageSwitcher, useLanguage } from './i18n';
import { AdminError, adminEnquiries, adminLogin, adminLogout, adminSession, markEnquiryReceived, type AdminEnquiry } from './admin-api';
import './admin.css';

export default function Admin() {
  const { locale, t } = useLanguage();
  const reduced = useReducedMotion();
  const client = useQueryClient();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminEnquiry | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const session = useQuery({ queryKey: ['admin', 'session'], queryFn: adminSession, retry: false, staleTime: 0 });
  const list = useQuery({ queryKey: ['admin', 'enquiries', q, grade, status, page], queryFn: () => adminEnquiries({ q, grade, status, page }), enabled: !!session.data, retry: false, staleTime: 0, refetchInterval: 30_000 });
  useEffect(() => { const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);
  useEffect(() => {
    if (!session.data) { setSelected(null); client.removeQueries({ queryKey: ['admin', 'enquiries'] }); }
  }, [session.data, client]);
  useEffect(() => {
    if (list.error instanceof AdminError && list.error.status === 401) client.setQueryData(['admin', 'session'], null);
  }, [list.error, client]);
  useEffect(() => { document.title = `${t('Admissions admin')} — ${t('Boborahim Mashrab')}`; }, [locale]);
  const login = useMutation({ mutationFn: () => adminLogin(username, password), onSuccess: identity => { window.scrollTo(0, 0); setPassword(''); client.setQueryData(['admin', 'session'], identity); }, retry: false });
  const logout = useMutation({ mutationFn: adminLogout, onSuccess: () => { setSelected(null); client.cancelQueries({ queryKey: ['admin'] }); client.removeQueries({ queryKey: ['admin'] }); client.setQueryData(['admin', 'session'], null); }, retry: false });
  const mark = useMutation({ mutationFn: markEnquiryReceived, onSuccess: item => {
    setSelected(current => current?.id === item.id ? item : current);
    client.invalidateQueries({ queryKey: ['admin', 'enquiries'] });
  }, onError: error => { if (error instanceof AdminError && error.status === 401) client.setQueryData(['admin', 'session'], null); }, retry: false });
  function submit(event: FormEvent) { event.preventDefault(); login.mutate(); }
  function clear() { setSearch(''); setQ(''); setGrade(''); setStatus(''); setPage(1); }
  function date(value: string) { return new Intl.DateTimeFormat(locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
  function gradeName(value: number | null) { return value === null ? t('Not recorded') : locale === 'uz' ? `${value}-sinf` : locale === 'ru' ? `${value} класс` : `Grade ${value}`; }
  function statusName(value: string) { return t(value === 'ready_for_review' ? 'Ready for review' : value === 'new' ? 'New' : 'Received'); }
  function errorMessage(error: Error | null) { return t(error instanceof AdminError ? error.message : 'The local admin service is unavailable. Please check that the backend is running.'); }

  return <div className="admin-page">
    <a className="skip" href="#admin-main">{t('Skip to content')}</a>
    <header className="admin-header"><Brand /><div className="admin-header-actions"><span className="local-badge"><i />{t('Local access only')}</span><LanguageSwitcher />{session.data && <button className="admin-secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>{t('Sign out')}</button>}</div></header>
    <main id="admin-main" className="admin-main">
      {!session.data ? <motion.section className="admin-login" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="admin-lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="27" height="27"><rect x="5" y="10" width="14" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></span>
        <p className="admin-eyebrow">{t('Admissions admin')}</p><h1>{t('Admin sign-in')}</h1><p>{t('Sign in to view admissions enquiries.')}</p>
        {session.isPending ? <p role="status">{t('Loading…')}</p> : session.isError ? <div role="alert" className="admin-error"><p>{errorMessage(session.error)}</p><button className="admin-secondary" onClick={() => session.refetch()}>{t('Try again')}</button></div> : <form onSubmit={submit}>
          <label htmlFor="admin-username">{t('Username')}<input id="admin-username" value={username} maxLength={120} autoComplete="username" onChange={event => setUsername(event.target.value)} required /></label>
          <label htmlFor="admin-password">{t('Password')}<input id="admin-password" type="password" value={password} maxLength={256} autoComplete="current-password" onChange={event => setPassword(event.target.value)} required /></label>
          {login.isError && <p role="alert" className="admin-error">{errorMessage(login.error)}</p>}
          <button className="button admin-login-button" type="submit" disabled={login.isPending}>{t(login.isPending ? 'Signing in…' : 'Sign in')}<span>↗</span></button>
        </form>}
        <p className="admin-access-hint">{t('Your local sign-in details are in .local/admin-access.txt.')}</p><a className="text-link" href="/">← {t('Back to website')}</a>
      </motion.section> : <>
        <div className="admin-title"><div><p className="admin-eyebrow">{t('Admissions admin')}</p><h1>{t('Admissions enquiries')}</h1><p>{t('Review enquiries from families, all in one place.')}</p></div><a className="admin-secondary" href="/">{t('Back to website')} ↗</a></div>
        {logout.isError && <p className="admin-error" role="alert">{errorMessage(logout.error)}</p>}
        <div className="admin-stats">{([['All enquiries', list.data?.stats.total], ['Received', list.data?.stats.received], ['Ready for review', list.data?.stats.ready_for_review]] as const).map(([label, count], index) => <div key={label} className={index === 0 ? 'admin-stat featured' : 'admin-stat'}><span>{t(label)}</span><strong>{count ?? '—'}</strong><i aria-hidden="true">{['↗', '↓', '✓'][index]}</i></div>)}</div>
        <section className="admin-inbox" aria-label={t('Enquiries')}>
          <div className="admin-toolbar"><label className="admin-search" htmlFor="admin-search"><span className="sr-only">{t('Search enquiries')}</span><span aria-hidden="true">⌕</span><input id="admin-search" type="search" placeholder={t('Search by name, email, phone, or reference')} value={search} maxLength={200} onChange={event => setSearch(event.target.value)} /></label>
            <label className="admin-filter"><span className="sr-only">{t('Grade')}</span><select aria-label={t('Grade')} value={grade} onChange={event => { setGrade(event.target.value); setPage(1); }}><option value="">{t('All grades')}</option>{Array.from({ length: 11 }, (_, i) => i + 1).map(value => <option key={value} value={value}>{gradeName(value)}</option>)}</select></label>
            <label className="admin-filter"><span className="sr-only">{t('Status')}</span><select aria-label={t('Status')} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{t('All statuses')}</option><option value="new">{t('New')}</option><option value="received">{t('Received')}</option><option value="ready_for_review">{t('Ready for review')}</option></select></label>
            <button className="admin-secondary" onClick={() => list.refetch()} disabled={list.isFetching}>{t('Refresh')} ↻</button>
          </div>
          {list.isPending ? <div className="admin-empty" role="status">{t('Loading…')}</div> : list.isError ? <div className="admin-empty admin-error" role="alert"><p>{errorMessage(list.error)}</p><button className="admin-secondary" onClick={() => list.refetch()}>{t('Try again')}</button></div> : list.data?.items.length ? <>
            <div className="admin-table-scroll"><table><thead><tr><th scope="col">{t('Name')}</th><th scope="col">{t('Grade')}</th><th scope="col">{t('Status')}</th><th scope="col">{t('Date')}</th><th scope="col"><span className="sr-only">{t('View details')}</span></th></tr></thead><tbody>{list.data.items.map(item => <tr key={item.id}><td><strong>{item.name}</strong><span className="admin-email">{item.email}</span><span className="admin-email">{item.phone || t('Not recorded')}</span><span className="admin-reference">{item.reference}</span></td><td><span className="admin-grade">{gradeName(item.grade)}</span></td><td><span className={`admin-status ${item.status}`}><i />{statusName(item.status)}</span></td><td className="admin-date">{date(item.created_at)}</td><td><button className="admin-view" onClick={() => { mark.reset(); setSelected(item); }} aria-label={`${t('View details')}: ${item.name}`}>{t('View details')} ↗</button></td></tr>)}</tbody></table></div>
          </> : <div className="admin-empty"><span aria-hidden="true">↙</span><h2>{t(q || grade || status ? 'No matching enquiries.' : 'No enquiries yet.')}</h2><p>{t(q || grade || status ? 'Try another search or clear your filters.' : 'New admissions enquiries will appear here.')}</p>{(q || grade || status) && <button className="admin-secondary" onClick={clear}>{t('Clear filters')}</button>}</div>}
          <div className="admin-pagination"><span>{list.data?.total ?? 0} {t('results')} · {t('Page')} {page} {t('of')} {Math.max(1, Math.ceil((list.data?.total ?? 0) / 25))}</span><div><button className="admin-secondary" disabled={page === 1 || list.isFetching} onClick={() => setPage(page - 1)}>← {t('Previous')}</button><button className="admin-secondary" disabled={!list.data || page * 25 >= list.data.total || list.isFetching} onClick={() => setPage(page + 1)}>{t('Next')} →</button></div></div>
        </section><p className="admin-workflow-note">{t('Ready for review means prepared by the local workflow, not reviewed by school staff.')}</p>
      </>}
      <p className="admin-local-footer">{t('Local database · no emails are sent')}</p>
    </main>
    <dialog ref={dialog} className="admin-dialog" aria-labelledby="enquiry-title" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      {selected && <div className="admin-dialog-content"><div className="admin-dialog-top"><p className="admin-eyebrow">{t('Enquiry details')}</p><button className="admin-close" aria-label={t('Close details')} onClick={() => setSelected(null)}>×</button></div><h2 id="enquiry-title">{selected.name}</h2><span className={`admin-status ${selected.status}`}><i />{statusName(selected.status)}</span><dl>{[[t('Email'), selected.email], [t('Phone number'), selected.phone || t('Not recorded')], [t('Grade'), gradeName(selected.grade)], [t('Date'), date(selected.created_at)], [t('Reference'), selected.reference]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{selected.received_at && <p className="admin-received-time">{t('Received on')}: {date(selected.received_at)}</p>}<div className="admin-message"><h3>{t('Message')}</h3><p>{selected.message || t('No additional message')}</p></div><div className="admin-detail-actions">{selected.received_at ? <p className="admin-received-confirmation" role="status">✓ {t('Enquiry marked as received.')}</p> : <button type="button" className="button" disabled={mark.isPending} onClick={() => mark.mutate(selected.id)}>{t(mark.isPending ? 'Marking…' : 'Mark as received')} <span>✓</span></button>}{mark.isError && <p className="admin-error" role="alert">{errorMessage(mark.error)}</p>}</div></div>}
    </dialog>
  </div>;
}
