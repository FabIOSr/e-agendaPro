/* ============================================
   AGENDAPRO SIDEBAR COMPONENT v2.0
   src/js/components/sidebar.js

   Componente de sidebar com navegação
   Pode ser usado para renderizar sidebar dinamicamente
   ============================================ */

/**
 * Renderiza a sidebar
 * @param {Object} options - Opções da sidebar
 * @param {string} options.currentPage - Página atual (para link ativo)
 * @param {boolean} options.showWidgets - Mostrar widgets (padrão: false)
 * @param {Array} options.widgets - Widgets customizados a mostrar
 * @returns {string} HTML da sidebar
 */
function renderSidebar(options = {}) {
  const {
    currentPage = '',
    showWidgets = false,
    widgets = []
  } = options;

  // Definição dos itens de navegação
  // URLs amigáveis do Firebase Hosting (sem .html)
  const navItems = [
    { icon: '📅', label: 'Agenda', href: '/painel', id: 'painel' },
    { icon: '👥', label: 'Clientes', href: '/clientes', id: 'clientes' },
    { icon: '📊', label: 'Relatórios', href: '/relatorio', id: 'relatorio' },
    { icon: '⚙️', label: 'Configurações', href: '/configuracoes', id: 'configuracoes' },
    { icon: '⭐', label: 'Plano', href: '/planos', id: 'planos' }
  ];

  // Gera HTML dos itens de navegação
  const navHTML = navItems.map(item => {
    const isActive = item.id === currentPage;
    const activeClass = isActive
      ? 'bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--color-text))] font-semibold'
      : 'text-[rgb(var(--color-faint))] hover:bg-[rgb(var(--bg-tertiary))] hover:text-[rgb(var(--color-text))] text-[13px] font-medium';

    return `
      <a href="${item.href}" class="flex items-center gap-3 p-3 rounded-lg ${activeClass} transition-all duration-200 no-underline whitespace-nowrap overflow-hidden">
        <span class="text-[18px] flex-shrink-0">${item.icon}</span>
        <span class="nav-item-label flex-1">${item.label}</span>
      </a>
    `;
  }).join('');

  // Gera HTML dos widgets (se houver)
  const widgetsHTML = showWidgets && widgets.length > 0
    ? `<div class="sidebar-widgets p-3 border-t border-[rgb(var(--color-bord))] mt-auto">
        ${widgets.map(widget => widget).join('')}
      </div>`
    : '';

  return `
    <aside
      id="sidebar"
      class="bg-[rgb(var(--bg-secondary))] border-r border-[rgb(var(--color-bord))] flex flex-col overflow-hidden transition-all duration-300"
      style="width: 240px;"
    >
      <!-- Sidebar Header -->
      <div class="p-4 border-b border-[rgb(var(--color-bord))] flex items-center justify-between">
        <span class="text-[10px] font-bold tracking-widest uppercase text-[rgb(var(--color-faint))]">Menu</span>
        <button
          onclick="toggleSidebar()"
          class="p-2 text-[rgb(var(--color-faint))] hover:bg-[rgb(var(--bg-tertiary))] hover:text-[rgb(var(--color-text))] rounded-lg transition-all duration-200 flex items-center justify-center bg-transparent border-0 cursor-pointer"
          aria-label="Colapsar sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 19l-7-7 7-7M8 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>

      <!-- Sidebar Navigation -->
      <nav class="p-3 flex flex-col gap-1">
        ${navHTML}
      </nav>

      <!-- Sidebar Widgets -->
      ${widgetsHTML}
    </aside>
  `;
}

/**
 * Injeta a sidebar em um elemento
 * @param {string} selector - Selector do elemento onde injetar
 * @param {Object} options - Opções da sidebar (mesmas de renderSidebar)
 */
function injectSidebar(selector, options) {
  const element = document.querySelector(selector);
  if (element) {
    element.innerHTML = renderSidebar(options);
  }
}

/**
 * Componente de Widget: Stats de Hoje
 * @param {Object} stats - Estatísticas { agendamentos, receita }
 * @returns {string} HTML do widget
 */
function renderStatsWidget(stats = { agendamentos: 8, receita: 'R$640' }) {
  return `
    <div class="mb-4">
      <div class="text-[10px] font-bold tracking-widest uppercase text-[rgb(var(--color-faint))] mb-2">Hoje</div>
      <div class="bg-[rgb(var(--bg-tertiary))] border border-[rgb(var(--color-bord))] rounded-lg p-2.5 mb-2">
        <div class="text-[11px] text-[rgb(var(--color-faint))]">Agendamentos</div>
        <div class="text-[15px] font-semibold font-mono text-[rgb(var(--color-lime))]">${stats.agendamentos}</div>
      </div>
      <div class="bg-[rgb(var(--bg-tertiary))] border border-[rgb(var(--color-bord))] rounded-lg p-2.5">
        <div class="text-[11px] text-[rgb(var(--color-faint))]">Receita</div>
        <div class="text-[15px] font-semibold font-mono text-[rgb(var(--color-lime-d))]">${stats.receita}</div>
      </div>
    </div>
  `;
}

/**
 * Componente de Widget: Mini Calendar
 * @param {Object} options - Opções do calendar { month, year, events }
 * @returns {string} HTML do widget
 */
function renderCalendarWidget(options = { month: 'Abril', year: 2026, events: [] }) {
  return `
    <div>
      <div class="text-[10px] font-bold tracking-widest uppercase text-[rgb(var(--color-faint))] mb-2">${options.month} ${options.year}</div>
      <div class="bg-[rgb(var(--bg-tertiary))] rounded-lg p-3">
        <div class="flex justify-between items-center mb-2 text-[12px] text-[rgb(var(--color-faint))]">
          <span class="cursor-pointer px-1.5 py-0.5 hover:text-[rgb(var(--color-text))]">‹</span>
          <span>${options.month}</span>
          <span class="cursor-pointer px-1.5 py-0.5 hover:text-[rgb(var(--color-text))]">›</span>
        </div>
        <div class="grid grid-cols-7 gap-px text-center text-[11px]">
          ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d =>
            `<span class="aspect-square flex items-center justify-center rounded text-[rgb(var(--color-faint))]">${d}</span>`
          ).join('')}
          <!-- Dias do mês seriam gerados dinamicamente -->
        </div>
      </div>
    </div>
  `;
}

// Export para uso em modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderSidebar,
    injectSidebar,
    renderStatsWidget,
    renderCalendarWidget
  };
}

/* ==========================================
   AUTO-INICIALIZAÇÃO (opcional)
   Se existir <aside id="sidebar-root"> no DOM, injeta automaticamente
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('sidebar-root');
  if (root && typeof renderSidebar === 'function') {
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

    root.innerHTML = renderSidebar({ currentPage, showWidgets: false });
  }
});
