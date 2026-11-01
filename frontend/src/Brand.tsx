import { useLanguage } from './i18n';

export default function Brand() {
  const { t } = useLanguage();
  return <a className="brand" href="/" aria-label={`${t('Boborahim Mashrab International School')} — ${t('Home')}`}><img className="brand-logo" src="/bm-logo.png" alt="" width="58" height="58" /><span className="brand-name">{t('Boborahim Mashrab')}<b>{t('INTERNATIONAL SCHOOL')}</b></span></a>;
}
