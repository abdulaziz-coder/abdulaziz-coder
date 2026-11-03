import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { LanguageProvider } from './i18n';
import './tailwind.css';
import './styles.css';
import './modern.css';
import './react.css';
import './photos.css';
import './languages.css';
import './responsive.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } });
const Admin = lazy(() => import('./Admin'));
const Page = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/') ? Admin : App;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><MotionConfig reducedMotion="user"><LanguageProvider><Suspense fallback={<p role="status">…</p>}><Page /></Suspense></LanguageProvider></MotionConfig></QueryClientProvider></React.StrictMode>,
);
