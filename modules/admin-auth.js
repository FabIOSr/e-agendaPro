// admin-auth.js
// Módulo de autenticação para painel admin do SaaS

const EDGE_FUNCTION_URL = `${window.SUPABASE_URL}/functions/v1/admin-validate`;

// ── GETTERS ───────────────────────────────────────────────────────────────

export function getAdminToken() {
  return localStorage.getItem('admin_token');
}

export function getAdminExpires() {
  return localStorage.getItem('admin_expires');
}

export function isAdminLoggedIn() {
  const token = getAdminToken();
  const expires = getAdminExpires();

  if (!token || !expires) return false;

  // Verifica se expirou
  return Date.now() < new Date(expires).getTime();
}

export function getAdminSession() {
  if (!isAdminLoggedIn()) return null;

  return {
    token: getAdminToken(),
    expires_at: new Date(getAdminExpires()),
  };
}

// ── ACTIONS ───────────────────────────────────────────────────────────────

export async function loginAdmin(password) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'validate_password',
      password
    })
  });

  const data = await response.json();

  if (!response.ok || !data.valid) {
    throw new Error(data.error || 'Senha inválida');
  }

  // Salva token
  localStorage.setItem('admin_token', data.token);
  localStorage.setItem('admin_expires', data.expires_at);

  return data;
}

export async function validateAdminSession() {
  const token = getAdminToken();

  if (!token) {
    return { valid: false, error: 'Sem token' };
  }

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify({ action: 'validate_token' })
  });

  const data = await response.json();

  if (!response.ok || !data.valid) {
    // Token inválido/expirado — limpa
    logoutAdmin();
    return { valid: false, error: data.error || 'Sessão expirada' };
  }

  return { valid: true };
}

export function logoutAdmin() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_expires');

  // Opcional: notificar edge function
  fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'logout' })
  }).catch(() => {}); // Ignora erro

  window.location.href = '/admin/login';
}

// ── PROTEÇÃO DE ROTA ──────────────────────────────────────────────────────

export async function requireAdminAuth() {
  const session = await validateAdminSession();

  if (!session.valid) {
    window.location.href = '/admin/login';
    throw new Error('Não autenticado como admin');
  }

  return getAdminSession();
}

// ── HEADERS PARA REQUESTS ─────────────────────────────────────────────────

export function adminHeaders(extra = {}) {
  const token = getAdminToken();
  if (!token) throw new Error('Sem token admin');

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${window.SUPABASE_ANON}`,
    'x-admin-token': token,
    ...extra
  };
}

// ── AUTO-REDIRECT SE JÁ LOGADO ────────────────────────────────────────────

export function redirectIfLoggedIn(redirectUrl = '/admin/dashboard') {
  if (isAdminLoggedIn()) {
    window.location.href = redirectUrl;
  }
}
