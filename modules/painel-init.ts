import {
  requireAuth,
  checkPlano,
  limiteFreeAtingido,
  watchSession,
  logout,
  authHeaders,
  supabase,
} from './auth-session.js';
import type { SupabaseClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

interface Prestador {
  id: string;
  nome: string;
  foto_url: string | null;
  plano: string;
  [key: string]: unknown;
}

interface User {
  id: string;
  [key: string]: unknown;
}

const FEATURES_PRO: Record<string, string[]> = {
  'Histórico de clientes': ['Perfil de cada cliente', 'Frequência e total gasto', 'Anotações por cliente'],
  'Relatório de receita': ['Receita mensal e por serviço', 'Horários e dias de pico', 'Exportação em PDF'],
  'WhatsApp automático': ['Confirmação instantânea', 'Lembrete D-1 automático', 'Links de cancelar e remarcar'],
  'Agendamentos ilimitados': ['Sem limite mensal', 'Histórico completo', 'Sem bloqueio de novos clientes'],
};

let PRESTADOR: Prestador | null = null;
let USER: User | null = null;

async function init(): Promise<void> {
  try {
    const { user, prestador } = await requireAuth();
    PRESTADOR = prestador;
    USER = user;
  } catch {
    return;
  }

  watchSession(() => {
    mostrarToast('Sessão encerrada. Redirecionando…');
    setTimeout(() => window.location.href = '/auth', 1500);
  });

  preencherUI();
  await verificarLimites();
}

function preencherUI(): void {
  if (!PRESTADOR) return;

  const elNome = document.getElementById('topbar-nome');
  if (elNome) elNome.textContent = PRESTADOR.nome?.split(' ')[0] ?? 'Você';

  const elAvatar = document.getElementById('topbar-avatar');
  if (elAvatar) {
    if (PRESTADOR.foto_url) {
      elAvatar.style.backgroundImage = `url(${PRESTADOR.foto_url})`;
      elAvatar.style.backgroundSize = 'cover';
      elAvatar.textContent = '';
    } else {
      elAvatar.textContent = (PRESTADOR.nome ?? 'A')[0].toUpperCase();
    }
  }

  const elPlano = document.getElementById('topbar-plano');
  if (elPlano) {
    elPlano.textContent = PRESTADOR.plano === 'pro' ? 'Pro' : 'Grátis';
    elPlano.className = `plano-badge ${PRESTADOR.plano}`;
  }

  const elLogout = document.getElementById('btn-logout');
  if (elLogout) elLogout.addEventListener('click', logout);
}

async function verificarLimites(): Promise<void> {
  if (!PRESTADOR || PRESTADOR.plano === 'pro') return;

  const limite = await limiteFreeAtingido(PRESTADOR);
  if (limite) {
    mostrarPaywallAgendamentos();
  }
}

export function exigirPro(elementId: string, nomeFuncao: string, features?: string[]): boolean {
  const el = document.getElementById(elementId);
  if (!el) return PRESTADOR ? checkPlano(PRESTADOR, 'pro') : false;

  const paywallExistente = el.querySelector('.paywall-inline');

  if (PRESTADOR && checkPlano(PRESTADOR, 'pro')) {
    if (paywallExistente) paywallExistente.remove();
    return true;
  }

  if (paywallExistente) return false;

  const bullets = features ?? FEATURES_PRO[nomeFuncao] ?? [];
  const bulletHtml = bullets.map(b => `<div class="paywall-feat">✓ ${b}</div>`).join('');

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

  el.dataset.originalContent = el.innerHTML;
  el.innerHTML = '';
  el.appendChild(gate);

  _injetarCSSPaywall();
  return false;
}

export function liberarGate(elementId: string): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (el.dataset.originalContent) {
    el.innerHTML = el.dataset.originalContent;
    delete el.dataset.originalContent;
  }
}

export function watchPlano(elementIds: string[] = []): void {
  if (!USER) return;
  supabase
    .channel('plano-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'prestadores',
      filter: `id=eq.${USER.id}`,
    }, (payload) => {
      if (payload.new.plano === 'pro' && PRESTADOR && PRESTADOR.plano !== 'pro') {
        PRESTADOR = { ...PRESTADOR, ...payload.new } as Prestador;
        const badge = document.getElementById('topbar-plano');
        if (badge) {
          badge.textContent = 'Pro';
          badge.className = 'plano-badge pro';
        }
        elementIds.forEach(id => liberarGate(id));
        mostrarToast('🎉 Plano Pro ativado! Aproveite.');
      }
    })
    .subscribe();
}

function _injetarCSSPaywall(): void {
  if (document.getElementById('paywall-inline-css')) return;
  const style = document.createElement('style');
  style.id = 'paywall-inline-css';
  style.textContent = `
    @keyframes _gate_in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    .paywall-inline {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: 52px 28px; background: var(--bg2, #181714);
      border: 1.5px solid rgba(200,240,96,.25); border-radius: 14px; margin: 8px 0;
      max-width: 420px; width: 100%; box-sizing: border-box;
      margin-left: auto; margin-right: auto; animation: _gate_in .3s ease;
    }
    .paywall-icon { font-size: 36px; margin-bottom: 14px; }
    .paywall-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 300; margin-bottom: 8px; color: var(--text, #f0ede6); }
    .paywall-desc { font-size: 14px; color: var(--muted, #8a8778); max-width: 340px; line-height: 1.65; margin-bottom: 16px; }
    .paywall-feats { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; text-align: left; }
    .paywall-feat { font-size: 13px; color: var(--muted, #8a8778); }
    .paywall-preco { font-family: 'Fraunces', serif; font-size: 52px; font-weight: 300; color: var(--lime, #c8f060); letter-spacing: -.02em; line-height: 1; margin-bottom: 2px; }
    .paywall-preco span { font-size: 16px; color: var(--muted, #8a8778); }
    .paywall-period { font-size: 12px; color: var(--faint, #4a4840); margin-bottom: 20px; }
    .paywall-btn { background: var(--lime, #c8f060); color: #1a2a08; border: none; border-radius: 10px; padding: 13px 32px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Syne', sans-serif; transition: background .15s; margin-bottom: 10px; }
    .paywall-btn:hover { background: #b8e050; }
    .paywall-trial { font-size: 11px; color: var(--faint, #4a4840); }
  `;
  document.head.appendChild(style);
}

function mostrarPaywallAgendamentos(): void {
  const btnNovo = document.getElementById('btn-novo-agendamento');
  if (btnNovo) {
    btnNovo.disabled = true;
    btnNovo.title = 'Limite do plano grátis atingido';
    btnNovo.style.opacity = '.4';
    btnNovo.style.cursor = 'not-allowed';
  }

  const banner = document.createElement('div');
  banner.id = 'banner-limite';
  banner.innerHTML = `
    <div style="background: linear-gradient(135deg, #1a2a08, #0e1f04); border: 1px solid rgba(200,240,96,.25); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; gap: 14px; margin-bottom: 16px; flex-wrap: wrap;">
      <span style="font-size:18px">🚀</span>
      <div style="flex:1;min-width:200px">
        <div style="font-size:14px;font-weight:600;color:#c8f060;margin-bottom:2px">Você usou os 30 agendamentos do mês</div>
        <div style="font-size:12px;color:#4a6a20;line-height:1.5">Assine o Pro para agendamentos ilimitados + WhatsApp automático</div>
      </div>
      <button onclick="window.location.href='/planos'" style="background:#c8f060;color:#1a2a08;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;white-space:nowrap;transition:background .15s" onmouseover="this.style.background='#b8e050'" onmouseout="this.style.background='#c8f060'">Assinar Pro →</button>
    </div>
  `;

  const agenda = document.getElementById('agenda-wrap') || document.querySelector('main') || document.body;
  agenda.prepend(banner);
}

function mostrarToast(msg: string): void {
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
    t!.style.opacity = '0';
    t!.style.transform = 'translateX(-50%) translateY(20px)';
  }, 3200);
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders(options.headers as Record<string, string> ?? {});
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    window.location.href = '/auth';
    throw new Error('Sessão expirada');
  }
  return res;
}

export function getPrestadorAtual(): Prestador | null {
  return PRESTADOR;
}

export function getUserAtual(): User | null {
  return USER;
}

init();