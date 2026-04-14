/* ============================================
   AGENDAPRO MOBILE NAV COMPONENT v2.0
   src/js/components/mobile-nav.js

   Componente de navegação inferior para mobile
   Bottom navigation fixa com ícones e labels
   ============================================ */

/**
 * Renderiza a navegação mobile (bottom nav)
 * @param {Object} options - Opções da navegação
 * @param {string} options.currentPage - Página atual (para link ativo)
 * @returns {string} HTML da navegação mobile
 */
function renderMobileNav(options = {}) {
  const {
    currentPage = ''
  } = options;

  // Definição dos itens de navegação
  // URLs amigáveis do Firebase Hosting (sem .html)
  const navItems = [
    { icon: '📅', label: 'Agenda', href: '/painel', id: 'painel' },
    { icon: '👥', label: 'Clientes', href: '/clientes', id: 'clientes' },
    { icon: '📊', label: 'Relatórios', href: '/relatorio', id: 'relatorio' },
    { icon: '⚙️', label: 'Config', href: '/configuracoes', id: 'configuracoes' },
    { icon: '⭐', label: 'Plano', href: '/planos', id: 'planos' }
  ];

  // Gera HTML dos itens de navegação
  const navHTML = navItems.map(item => {
    const isActive = item.id === currentPage;
    const activeClass = isActive
      ? 'text-[rgb(var(--color-lime))]'
      : 'text-[rgb(var(--color-faint))]';

    return `
      <a href="${item.href}"
         class="flex flex-col items-center gap-1 p-2 rounded-lg ${activeClass} transition-all duration-200 no-underline"
         aria-label="${item.label}">
        <span class="text-[20px]">${item.icon}</span>
        <span class="text-[10px] font-medium">${item.label}</span>
      </a>
    `;
  }).join('');

  return `
    <nav class="show-mobile-only flex fixed bottom-0 left-0 right-0 z-[100] bg-[rgb(var(--bg-tertiary))] border-t border-[rgb(var(--color-bord))] p-2 justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[max(8px,env(safe-area-inset-bottom))]">
      ${navHTML}
    </nav>
  `;
}

/**
 * Injeta a navegação mobile em um elemento
 * @param {string} selector - Selector do elemento onde injetar
 * @param {Object} options - Opções da navegação (mesmas de renderMobileNav)
 */
function injectMobileNav(selector, options) {
  const element = document.querySelector(selector);
  if (element) {
    element.innerHTML = renderMobileNav(options);
  }
}

/**
 * Renderiza a versão simplificada da navegação mobile (sem labels)
 * @param {Object} options - Opções da navegação
 * @returns {string} HTML da navegação simplificada
 */
function renderMobileNavCompact(options = {}) {
  const {
    currentPage = ''
  } = options;

  const navItems = [
    { icon: '📅', href: '/painel', id: 'painel', label: 'Agenda' },
    { icon: '👥', href: '/clientes', id: 'clientes', label: 'Clientes' },
    { icon: '📊', href: '/relatorio', id: 'relatorio', label: 'Relatórios' },
    { icon: '⚙️', href: '/configuracoes', id: 'configuracoes', label: 'Configurações' },
    { icon: '⭐', href: '/planos', id: 'planos', label: 'Plano' }
  ];

  const navHTML = navItems.map(item => {
    const isActive = item.id === currentPage;
    const activeClass = isActive
      ? 'text-[rgb(var(--color-lime))]'
      : 'text-[rgb(var(--color-faint))]';

    return `
      <a href="${item.href}"
         class="${activeClass} transition-all duration-200 no-underline"
         aria-label="${item.label}">
        <span class="text-[20px]">${item.icon}</span>
      </a>
    `;
  }).join('');

  return `
    <nav class="show-mobile-only flex fixed bottom-0 left-0 right-0 z-[100] bg-[rgb(var(--bg-tertiary))] border-t border-[rgb(var(--color-bord))] px-4 py-3 justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[max(12px,env(safe-area-inset-bottom))]">
      ${navHTML}
    </nav>
  `;
}

// Export para uso em modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderMobileNav,
    injectMobileNav,
    renderMobileNavCompact
  };
}

/* ==========================================
   AUTO-INICIALIZAÇÃO (opcional)
   Se existir <nav id="mobile-nav-root"> no DOM, injeta automaticamente
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('mobile-nav-root');
  if (root && typeof renderMobileNav === 'function') {
    // Detectar página atual pela URL
    const path = window.location.pathname;
    const pageMap = {
      '/painel': 'painel',
      '/clientes': 'clientes',
      '/relatorio': 'relatorio',
      '/configuracoes': 'configuracoes',
      '/planos': 'planos'
    };
    const currentPage = pageMap[path] || '';

    root.innerHTML = renderMobileNav({ currentPage });
  }
});
