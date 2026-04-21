const EDGE_FUNCTION_URL = `${window.SUPABASE_URL}/functions/v1/admin-validate`;

export interface AdminSession {
  token: string;
  expires_at: Date;
}

export interface ValidateResult {
  valid: boolean;
  error?: string;
}

export function getAdminToken(): string | null {
  return localStorage.getItem('admin_token');
}

export function getAdminExpires(): string | null {
  return localStorage.getItem('admin_expires');
}

export function isAdminLoggedIn(): boolean {
  const token = getAdminToken();
  const expires = getAdminExpires();

  if (!token || !expires) return false;

  return Date.now() < new Date(expires).getTime();
}

export function getAdminSession(): AdminSession | null {
  if (!isAdminLoggedIn()) return null;

  return {
    token: getAdminToken()!,
    expires_at: new Date(getAdminExpires()!),
  };
}

export async function loginAdmin(password: string): Promise<{ token: string; expires_at: string }> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'validate_password',
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.valid) {
    throw new Error(data.error || 'Senha inválida');
  }

  localStorage.setItem('admin_token', data.token);
  localStorage.setItem('admin_expires', data.expires_at);

  return data;
}

export async function validateAdminSession(): Promise<ValidateResult> {
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
    body: JSON.stringify({ action: 'validate_token' }),
  });

  const data = await response.json();

  if (!response.ok || !data.valid) {
    logoutAdmin();
    return { valid: false, error: data.error || 'Sessão expirada' };
  }

  return { valid: true };
}

export function logoutAdmin(): void {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_expires');

  fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'logout' }),
  }).catch(() => {});

  window.location.href = '/admin/login';
}

export async function requireAdminAuth(): Promise<AdminSession> {
  const session = await validateAdminSession();

  if (!session.valid) {
    window.location.href = '/admin/login';
    throw new Error('Não autenticado como admin');
  }

  return getAdminSession()!;
}

export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAdminToken();
  if (!token) throw new Error('Sem token admin');

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${window.SUPABASE_ANON}`,
    'x-admin-token': token,
    ...extra,
  };
}

export function redirectIfLoggedIn(redirectUrl: string = '/admin/dashboard'): void {
  if (isAdminLoggedIn()) {
    window.location.href = redirectUrl;
  }
}