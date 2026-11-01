import React from 'react';
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

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><MotionConfig reducedMotion="user"><LanguageProvider><App /></LanguageProvider></MotionConfig></QueryClientProvider></React.StrictMode>,
);
