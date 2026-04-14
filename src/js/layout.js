/* ============================================
   AGENDAPRO LAYOUT CONTROLLER v2.0
   src/js/layout.js

   Controle de sidebar, theme toggle e FOUC prevention
   Baseado no protótipo new-layout-tailwind.html
   ============================================ */

// Estado da sidebar
let isCollapsed = false;

/* ==========================================
   TOGGLE SIDEBAR
   ========================================== */

/**
 * Alterna entre sidebar expandida (240px) e colapsada (64px)
 * Atualiza: grid layout, data attribute, localStorage, ícone
 */
function toggleSidebar() {
  isCollapsed = !isCollapsed;
  const layout = document.getElementById('appLayout');
  const sidebar = document.getElementById('sidebar');

  // Toggle classe de layout
  if (layout) {
    layout.classList.toggle('sidebar-collapsed', isCollapsed);
  }

  // Sincronizar data attribute (para prevenir FOUC no reload)
  if (isCollapsed) {
    document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
  } else {
    document.documentElement.removeAttribute('data-sidebar-collapsed');
  }

  // Ajustar largura da sidebar
  if (sidebar) {
    if (isCollapsed) {
      sidebar.style.width = '64px';
    } else {
      sidebar.style.width = '240px';
    }
  }

  // Salvar preferência
  localStorage.setItem('sidebar-collapsed', isCollapsed);

  // Atualizar ícone
  updateSidebarToggleIcon();
}

/**
 * Atualiza o ícone do botão de toggle da sidebar
 */
function updateSidebarToggleIcon() {
  const toggle = document.getElementById('sidebarToggle');
  if (!toggle) return;

  toggle.innerHTML = isCollapsed
    ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 10h18M3 14h18"/></svg>';
}

/* ==========================================
   TOGGLE THEME (DARK/LIGHT)
   ========================================== */

/**
 * Alterna entre tema claro e escuro
 * Atualiza: data-theme attribute, localStorage, ícone
 */
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);

  // Atualizar ícone
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  // Se houver charts, atualizar cores
  if (typeof updateChartsTheme === 'function') {
    updateChartsTheme(next);
  }
}

/* ==========================================
   FEATURE FLAG (?layout=novo)
   ========================================== */

/**
 * Verifica se feature flag está ativa
 * @returns {boolean} True se ?layout=novo está presente na URL
 */
function isNewLayoutActive() {
  const params = new URLSearchParams(window.location.search);
  return params.get('layout') === 'novo';
}

// Aplicar data attribute se feature flag estiver ativa
if (isNewLayoutActive()) {
  document.documentElement.setAttribute('data-layout', 'novo');
}

/* ==========================================
   INITIALIZATION (DOMContentLoaded)
   ========================================== */

/**
 * Inicializa o layout com estado salvo
 * Executa após o DOM estar pronto
 */
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar - já foi aplicada via script inline, apenas sincronizar estado
  const savedSidebar = localStorage.getItem('sidebar-collapsed');
  if (savedSidebar === 'true') {
    isCollapsed = true; // Sincronizar variável
    updateSidebarToggleIcon(); // Atualizar ícone
  }

  // Tema - já foi aplicado via script inline, apenas atualizar ícone
  const savedTheme = localStorage.getItem('theme');
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  // Inicializar charts se existirem
  if (typeof initCharts === 'function') {
    initCharts();
  }
});

/* ==========================================
   EXPORTS (para uso em modules)
   ============================================ */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toggleSidebar,
    toggleTheme,
    isNewLayoutActive,
    isCollapsed: () => isCollapsed
  };
}
