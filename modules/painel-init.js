// painel-init.js
// Cole este bloco no <script> de CADA página protegida (painel, configurações, relatório…)
// Ele cuida de: verificar sessão, redirecionar se não logado, expor user/prestador globalmente.

import {
  requireAuth,
  checkPlano,
  limiteFreeAtingido,
  watchSession,
  logout,
  authHeaders,
  supabase,
} from './auth-session.js';

// ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────
let PRESTADOR = null;
let USER      = null;

async function init() {
  // 1. Exige sessão — redireciona para /auth se não tiver
  try {
    const { user, prestador } = await requireAuth();
    PRESTADOR = prestador;
    USER      = user;
  } catch {
    return; // requireAuth já redirecionou
  }

  // 2. Escuta logout em outras abas
  watchSession(() => {
    mostrarToast('Sessão encerrada. Redirecionando…');
    setTimeout(() => window.location.href = '/auth', 1500);
  });

  // 3. Preenche UI com dados do prestador
  preencherUI();

  // 4. Verifica limites do plano
  await verificarLimites();
}

// ── PREENCHE TOPBAR / AVATAR ───────────────────────────────────────────────
function preencherUI() {
  // Topbar nome
  const elNome = document.getElementById('topbar-nome');
  if (elNome) elNome.textContent = PRESTADOR.nome?.split(' ')[0] ?? 'Você';

  // Avatar com inicial
  const elAvatar = document.getElementById('topbar-avatar');
  if (elAvatar) {
    if (PRESTADOR.foto_url) {
      elAvatar.style.backgroundImage = `url(${PRESTADOR.foto_url})`;
      elAvatar.style.backgroundSize  = 'cover';
      elAvatar.textContent = '';
    } else {
      elAvatar.textContent = (PRESTADOR.nome ?? 'A')[0].toUpperCase();
    }
  }

  // Badge de plano
  const elPlano = document.getElementById('topbar-plano');
  if (elPlano) {
    elPlano.textContent = PRESTADOR.plano === 'pro' ? 'Pro' : 'Grátis';
    elPlano.className   = `plano-badge ${PRESTADOR.plano}`;
  }

  // Botão de logout
  const elLogout = document.getElementById('btn-logout');
  if (elLogout) elLogout.addEventListener('click', logout);
}

// ── VERIFICA LIMITES DE PLANO ─────────────────────────────────────────────
async function verificarLimites() {
  if (PRESTADOR.plano === 'pro') return; // pro não tem limite

  const limite = await limiteFreeAtingido(PRESTADOR);
  if (limite) {
    mostrarPaywallAgendamentos();
  }
}

// ── GATE DE FUNCIONALIDADE PRO ────────────────────────────────────────────

const FEATURES_PRO = {
  'Histórico de clientes':  ['Perfil de cada cliente', 'Frequência e total gasto', 'Anotações por cliente'],
  'Relatório de receita':   ['Receita mensal e por serviço', 'Horários e dias de pico', 'Exportação em PDF'],
  'WhatsApp automático':    ['Confirmação instantânea', 'Lembrete D-1 automático', 'Links de cancelar e remarcar'],
  'Agendamentos ilimitados':['Sem limite mensal', 'Histórico completo', 'Sem bloqueio de novos clientes'],
};

/**
 * Verifica se o usuário pode acessar uma funcionalidade Pro.
 * Se não puder, substitui o elemento pelo paywall inline.
 * Se puder, remove paywall anterior (útil após upgrade em tempo real).
 *
 * @param {string}  elementId   - id do elemento alvo
 * @param {string}  nomeFuncao  - nome amigável exibido no paywall
 * @param {string[]} features   - lista de bullets do que é desbloqueado (opcional)
 * @returns {boolean}           - true = acesso liberado, false = paywall exibido
 */
export function exigirPro(elementId, nomeFuncao, features) {
  const el = document.getElementById(elementId);
  if (!el) return checkPlano(PRESTADOR, 'pro');

  // Remove paywall anterior se plano foi atualizado
  const paywallExistente = el.querySelector('.paywall-inline');

  if (checkPlano(PRESTADOR, 'pro')) {
    if (paywallExistente) paywallExistente.remove();
    return true;
  }

  // Já tem paywall — não reinjeta
  if (paywallExistente) return false;

  const bullets = features ?? FEATURES_PRO[nomeFuncao] ?? [];
  const bulletHtml = bullets.map(b =>
    `<div class="paywall-feat">✓ ${b}</div>`
  ).join('');

  const gate = document.createElement('div');
  gate.className = 'paywall-inline';
  gate.innerHTML = `
    <div class="paywall-icon">🔒</div>
    <div class="paywall-title">${nomeFuncao}</div>
    <p class="paywall-desc">Disponível no plano Pro. Desbloqueie agora e tenha acesso imediato.</p>
    ${bulletHtml ? `<div class="paywall-feats">${bulletHtml}</div>` : ''}
    <div class="paywall-preco">R$39<span>/mês</span></div>
    <div class="paywall-period">cancele quando quiser · sem fidelidade</div>
    <button class="paywall-btn" onclick="window.location.href='/planos'">✦ Assinar Pro agora</button>
    <div class="paywall-trial">Teste grátis por 7 dias — sem cartão</div>
  `;

  // Preserva conteúdo original em data-attr para restaurar após upgrade
  el.dataset.originalContent = el.innerHTML;
  el.innerHTML = '';
  el.appendChild(gate);

  _injetarCSSPaywall();
  return false;
}

/**
 * Restaura elemento bloqueado após upgrade (sem reload de página).
 * Chame após webhook confirmar pagamento via Supabase Realtime.
 */
export function liberarGate(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (el.dataset.originalContent) {
    el.innerHTML = el.dataset.originalContent;
    delete el.dataset.originalContent;
  }
}

/**
 * Verifica plano em tempo real via Supabase Realtime.
 * Atualiza PRESTADOR e libera gates automaticamente quando usuário faz upgrade.
 */
export function watchPlano(elementIds = []) {
  if (!USER) return;
  supabase
    .channel('plano-changes')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'prestadores',
      filter: `id=eq.${USER.id}`,
    }, (payload) => {
      if (payload.new.plano === 'pro' && PRESTADOR.plano !== 'pro') {
        PRESTADOR = { ...PRESTADOR, ...payload.new };
        // Atualiza badge na topbar
        const badge = document.getElementById('topbar-plano');
        if (badge) { badge.textContent = 'Pro'; badge.className = 'plano-badge pro'; }
        // Libera todos os gates registrados
        elementIds.forEach(id => liberarGate(id));
        mostrarToast('🎉 Plano Pro ativado! Aproveite.');
      }
    })
    .subscribe();
}

function _injetarCSSPaywall() {
  if (document.getElementById('paywall-inline-css')) return;
  const style = document.createElement('style');
  style.id = 'paywall-inline-css';
  style.textContent = `
    @keyframes _gate_in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    .paywall-inline {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; padding: 52px 28px;
      background: var(--bg2, #181714);
      border: 1.5px solid rgba(200,240,96,.25);
      border-radius: 14px; margin: 8px 0;
      max-width: 420px;
      width: 100%;
      box-sizing: border-box;
      margin-left: auto;
      margin-right: auto;
      animation: _gate_in .3s ease;
    }
    .paywall-icon    { font-size: 36px; margin-bottom: 14px; }
    .paywall-title   { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 300; margin-bottom: 8px; color: var(--text, #f0ede6); }
    .paywall-desc    { font-size: 14px; color: var(--muted, #8a8778); max-width: 340px; line-height: 1.65; margin-bottom: 16px; }
    .paywall-feats   { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; text-align: left; }
    .paywall-feat    { font-size: 13px; color: var(--muted, #8a8778); }
    .paywall-feat    { color: var(--lime-d, #8ab830); }
    .paywall-preco   {
      font-family: 'Fraunces', serif; font-size: 52px; font-weight: 300;
      color: var(--lime, #c8f060); letter-spacing: -.02em; line-height: 1; margin-bottom: 2px;
    }
    .paywall-preco span  { font-size: 16px; color: var(--muted, #8a8778); }
    .paywall-period  { font-size: 12px; color: var(--faint, #4a4840); margin-bottom: 20px; }
    .paywall-btn {
      background: var(--lime, #c8f060); color: #1a2a08;
      border: none; border-radius: 10px; padding: 13px 32px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      font-family: 'Syne', sans-serif; transition: background .15s; margin-bottom: 10px;
    }
    .paywall-btn:hover { background: #b8e050; }
    .paywall-trial   { font-size: 11px; color: var(--faint, #4a4840); }
  `;
  document.head.appendChild(style);
}

// ── PAYWALL DE AGENDAMENTOS (free no limite) ──────────────────────────────
function mostrarPaywallAgendamentos() {
  // Desabilita botão de novo agendamento
  const btnNovo = document.getElementById('btn-novo-agendamento');
  if (btnNovo) {
    btnNovo.disabled = true;
    btnNovo.title = 'Limite do plano grátis atingido';
    btnNovo.style.opacity = '.4';
    btnNovo.style.cursor  = 'not-allowed';
  }

  // Banner no topo do painel
  const banner = document.createElement('div');
  banner.id = 'banner-limite';
  banner.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1a2a08, #0e1f04);
      border: 1px solid rgba(200,240,96,.25);
      border-radius: 10px; padding: 14px 18px;
      display: flex; align-items: center; gap: 14px;
      margin-bottom: 16px; flex-wrap: wrap;
    ">
      <span style="font-size:18px">🚀</span>
      <div style="flex:1;min-width:200px">
        <div style="font-size:14px;font-weight:600;color:#c8f060;margin-bottom:2px">Você usou os 10 agendamentos do mês</div>
        <div style="font-size:12px;color:#4a6a20;line-height:1.5">Assine o Pro para agendamentos ilimitados + WhatsApp automático</div>
      </div>
      <button onclick="window.location.href='/planos'"
        style="background:#c8f060;color:#1a2a08;border:none;border-radius:8px;
               padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;
               font-family:'Syne',sans-serif;white-space:nowrap;transition:background .15s"
        onmouseover="this.style.background='#b8e050'"
        onmouseout="this.style.background='#c8f060'">
        Assinar Pro →
      </button>
    </div>
  `;

  const agenda = document.getElementById('agenda-wrap') || document.querySelector('main') || document.body;
  agenda.prepend(banner);
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function mostrarToast(msg) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
      background:#0e0d0a;color:#f0ede6;border-radius:10px;padding:12px 20px;
      font-size:13px;font-family:'Syne',sans-serif;font-weight:500;
      opacity:0;transition:all .3s;pointer-events:none;white-space:nowrap;z-index:9999;
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 3200);
}

// ── HELPER: FETCH AUTENTICADO ─────────────────────────────────────────────
/**
 * Wrapper para fetch com token JWT injetado automaticamente.
 * Uso: const data = await authFetch('/functions/v1/horarios-disponiveis', { method:'POST', body:... })
 */
export async function authFetch(url, options = {}) {
  const headers = await authHeaders(options.headers ?? {});
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    window.location.href = '/auth';
    throw new Error('Sessão expirada');
  }
  return res;
}

// ── EXPORTA ESTADO GLOBAL ─────────────────────────────────────────────────
export function getPrestadorAtual() { return PRESTADOR; }
export function getUserAtual()      { return USER; }

// ── AUTO-INICIA ───────────────────────────────────────────────────────────
init();
