/* ============================================
   AGENDAPRO TOPBAR COMPONENT v2.0
   src/js/components/topbar.js

   Componente de topbar unificada
   Pode ser usado para renderizar topbar dinamicamente
   ============================================ */

/**
 * Renderiza a topbar
 * @param {Object} options - Opções da topbar
 * @param {boolean} options.showDateNav - Mostrar navegação de data (padrão: false)
 * @param {boolean} options.showNewButton - Mostrar botão "+ Novo" (padrão: false)
 * @param {string} options.pageName - Nome da página atual (para link ativo)
 * @param {Object} options.user - Dados do usuário { name, avatar, plan }
 * @returns {string} HTML da topbar
 */
function renderTopbar(options = {}) {
  const {
    showDateNav = false,
    showNewButton = false,
    pageName = '',
    user = { name: 'Profissional', avatar: 'AC', plan: 'Pro' }
  } = options;

  return `
    <div class="sticky top-0 z-[100] flex items-center justify-between px-5 h-14 bg-[rgb(var(--bg-secondary))] border-b border-[rgb(var(--color-bord))]">
      <!-- Topbar Left -->
      <div class="flex items-center gap-4">
        <button
          onclick="toggleSidebar()"
          id="sidebarToggle"
          class="p-2 rounded-lg text-[rgb(var(--color-faint))] hover:bg-[rgb(var(--bg-tertiary))] hover:text-[rgb(var(--color-text))] transition-all duration-200 flex items-center justify-center bg-transparent border-0 cursor-pointer"
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M3 10h18M3 14h18"/>
          </svg>
        </button>
        <a href="/painel" class="font-fraunces text-[18px] font-normal flex items-center gap-2 no-underline text-[rgb(var(--color-text))]">
          <div class="w-[7px] h-[7px] bg-[rgb(var(--color-lime))] rounded-full logo-dot" style="box-shadow: 0 0 8px rgba(200,240,96,0.5);"></div>
          AgendaPro
        </a>
      </div>

      <!-- Topbar Center (opcional) -->
      ${showDateNav ? `
        <div class="flex items-center gap-2 hide-mobile">
          <button class="px-2 py-1 bg-transparent border border-[rgb(var(--color-bord))] rounded-md text-[rgb(var(--color-faint))] hover:border-[rgb(var(--color-bord2))] hover:text-[rgb(var(--color-text))] cursor-pointer transition-all duration-200" aria-label="Dia anterior">
            ‹
          </button>
          <span class="text-[14px] font-medium">Hoje, 14 de Abril</span>
          <button class="px-2 py-1 bg-transparent border border-[rgb(var(--color-bord))] rounded-md text-[rgb(var(--color-faint))] hover:border-[rgb(var(--color-bord2))] hover:text-[rgb(var(--color-text))] cursor-pointer transition-all duration-200" aria-label="Próximo dia">
            ›
          </button>
        </div>
      ` : ''}

      <!-- Topbar Right -->
      <div class="flex items-center gap-3">
        <button
          onclick="toggleTheme()"
          id="themeToggle"
          class="p-2 text-[rgb(var(--color-faint))] hover:bg-[rgb(var(--bg-tertiary))] hover:text-[rgb(var(--color-text))] rounded-lg text-[18px] transition-all duration-200 bg-transparent border-0 cursor-pointer"
          title="Alternar tema"
          aria-label="Alternar tema claro/escuro"
        >
          🌙
        </button>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[rgb(var(--color-lime))] text-[rgb(var(--color-lime-ink))]">
          ${user.plan}
        </span>
        ${showNewButton ? `
          <button class="px-3.5 py-2 bg-[rgb(var(--color-lime))] text-[rgb(var(--color-lime-ink))] border-none rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200 hover:bg-[rgb(var(--color-lime-d))]">
            + Novo
          </button>
        ` : ''}
        <div class="w-8 h-8 bg-[rgb(var(--color-lime))] rounded-full flex items-center justify-center text-[12px] font-semibold text-[rgb(var(--color-lime-ink))] cursor-pointer hover:scale-105 transition-transform duration-200" title="${user.name}">
          ${user.avatar}
        </div>
      </div>
    </div>
  `;
}

/**
 * Injeta a topbar em um elemento
 * @param {string} selector - Selector do elemento onde injetar
 * @param {Object} options - Opções da topbar (mesmas de renderTopbar)
 */
function injectTopbar(selector, options) {
  const element = document.querySelector(selector);
  if (element) {
    element.innerHTML = renderTopbar(options);
  }
}

// Export para uso em modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderTopbar, injectTopbar };
}
