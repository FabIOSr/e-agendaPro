/**
 * app.js — Entry point principal do AgendaPro
 *
 * Inicializa Alpine.js para páginas que precisarem.
 * A landing-page usa JS vanilla próprio (já funciona).
 */

import Alpine from 'alpinejs';

window.Alpine = Alpine;
Alpine.start();

console.log(
  `%cAgendaPro v${import.meta.env.VITE_VERSION || 'dev'}`,
  'color: #c8f060; font-weight: bold; font-size: 12px;',
  `| ${import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development'}`
);

/* ── Novo Layout: Importar JS do layout e componentes ── */
import './js/layout.js';
import './js/components/topbar.js';
import './js/components/sidebar.js';
import './js/components/mobile-nav.js';
