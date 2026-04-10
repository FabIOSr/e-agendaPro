/**
 * Analytics server-side para Edge Functions (Deno)
 * Wrapper para sendServerEvent com interface simplificada.
 */

export async function sendServerEvent(name: string, props: Record<string, unknown>, getEnv: (key: string) => string | undefined) {
  const domain = getEnv('PLAUSIBLE_DOMAIN')
    || getEnv('APP_URL')?.replace('https://', '').replace('http://', '');
  if (!domain) return;

  try {
    await fetch('https://plausible.io/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        url: `${getEnv('APP_URL') || 'https://e-agendapro.web.app'}/server-event`,
        domain,
        props: props || {},
      }),
    });
  } catch (_) {
    // Silenciar — analytics nao deve quebrar a funcao
  }
}

export default { sendServerEvent };
