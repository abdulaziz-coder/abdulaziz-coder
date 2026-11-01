import { useId } from 'react';
import type { Locale } from './translations';

export default function LanguageFlag({ locale }: { locale: Locale }) {
  const id = useId();
  return <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">
    <defs><clipPath id={id}><rect width="30" height="20" rx="3" /></clipPath></defs>
    <g clipPath={`url(#${id})`}>
      {locale === 'uz' ? <>
        <path fill="#1eb5d3" d="M0 0h30v20H0z" /><path fill="#fff" d="M0 7h30v6H0z" /><path fill="#28a454" d="M0 14h30v6H0z" /><path fill="#d93046" d="M0 6.4h30v.6H0zm0 6.6h30v.6H0z" />
        <path fill="#fff" d="M6.2 1a2.5 2.5 0 1 0 0 5 2.1 2.1 0 1 1 0-5" />
        {[3, 4, 5].flatMap((count, row) => Array.from({ length: count }, (_, col) => <polygon key={`${row}-${col}`} transform={`translate(${10 + col * 1.8 + (5 - count) * 1.8} ${1.5 + row * 1.7})`} points="0,-.65 .2,-.2 .68,-.2 .3,.1 .45,.6 0,.3 -.45,.6 -.3,.1 -.68,-.2 -.2,-.2" fill="white" />))}
      </> : locale === 'ru' ? <><path fill="#fff" d="M0 0h30v7H0z" /><path fill="#2355a5" d="M0 7h30v6H0z" /><path fill="#da3745" d="M0 13h30v7H0z" /></> : <>
        <path fill="#25487b" d="M0 0h30v20H0z" /><path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20" /><path stroke="#ce3448" strokeWidth="1.6" d="m0 0 30 20M30 0 0 20" /><path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" /><path stroke="#ce3448" strokeWidth="4" d="M15 0v20M0 10h30" />
      </>}
    </g>
    <rect x=".5" y=".5" width="29" height="19" rx="2.5" fill="none" stroke="#174265" strokeOpacity=".12" />
  </svg>;
}
