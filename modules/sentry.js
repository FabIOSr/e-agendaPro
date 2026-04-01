// modules/sentry.js
// Módulo de inicialização e configuração do Sentry
// Documentação: https://docs.sentry.io/platforms/javascript/

(function() {
  // Configurações do Sentry
  const SENTRY_CONFIG = {
    dsn: window.SENTRY_DSN || '',
    environment: window.ENV?.SENTRY_ENVIRONMENT || 'production',
    release: 'agendapro@' + (window.ENV?.VERSION || '1.0.0'),
    
    // Taxa de amostragem para performance monitoring (0-1)
    tracesSampleRate: 0.1, // 10% das transações são monitoradas
    
    // Taxa de amostragem para replays de sessão (0-1)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0, // 100% dos erros geram replay
    
    // Integrations
    integrations: []
  };

  // Verifica se o Sentry está configurado
  if (!SENTRY_CONFIG.dsn || SENTRY_CONFIG.dsn === 'YOUR_SENTRY_DSN') {
    console.warn('⚠️ Sentry DSN não configurado. Monitoramento desativado.');
    window.Sentry = null;
    return;
  }

  // Função para carregar Sentry dinamicamente
  function loadSentry() {
    return new Promise((resolve, reject) => {
      // Verifica se já está carregado
      if (window.Sentry && window.Sentry.init) {
        resolve(window.Sentry);
        return;
      }

      // Cria script tag para carregar Sentry SDK
      const script = document.createElement('script');
      // URL alternativa que funciona melhor com adblockers
      script.src = 'https://browser.sentry-cdn.com/7.119.0/bundle.tracing.min.js';
      script.crossOrigin = 'anonymous';
      
      script.onload = () => {
        if (window.Sentry && window.Sentry.init) {
          resolve(window.Sentry);
        } else {
          reject(new Error('Sentry não inicializou corretamente'));
        }
      };
      
      script.onerror = () => {
        // Falha silenciosa - provavelmente bloqueado por adblocker
        console.log('ℹ️ Sentry SDK bloqueado (adblocker/privacidade). Funcionalidades de monitoramento desativadas.');
        resolve(null);
      };
      
      document.head.appendChild(script);
    });
  }

  // Função para inicializar Sentry com configurações adicionais
  async function initSentry() {
    try {
      const Sentry = await loadSentry();

      // Se Sentry foi bloqueado (adblocker), não faz nada
      if (!Sentry || !Sentry.init) {
        return null;
      }

      // Adiciona integração de replay se disponível
      if (Sentry.Replay) {
        SENTRY_CONFIG.integrations.push(
          new Sentry.Replay({
            maskAllText: true,
            blockAllMedia: true,
          })
        );
      }

      // Inicializa Sentry
      Sentry.init(SENTRY_CONFIG);

      // Configura contexto global
      Sentry.setContext('app', {
        name: 'AgendaPro',
        version: SENTRY_CONFIG.release,
        url: window.location.href
      });

      console.log('✅ Sentry inicializado com sucesso');
      return Sentry;
    } catch (error) {
      console.error('❌ Erro ao inicializar Sentry:', error);
      return null;
    }
  }

  // Função utilitária para capturar exceções
  function captureException(error, options = {}) {
    if (window.Sentry) {
      window.Sentry.captureException(error, options);
    }
  }

  // Função utilitária para capturar mensagens
  function captureMessage(message, level = 'info') {
    if (window.Sentry) {
      window.Sentry.captureMessage(message, level);
    }
  }

  // Função para definir usuário no contexto
  function setUser(user) {
    if (window.Sentry && user) {
      window.Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.nome
      });
    }
  }

  // Função para limpar usuário (logout)
  function clearUser() {
    if (window.Sentry) {
      window.Sentry.setUser(null);
    }
  }

  // Expõe funções globalmente
  window.SentryInit = initSentry;
  window.SentryCaptureException = captureException;
  window.SentryCaptureMessage = captureMessage;
  window.SentrySetUser = setUser;
  window.SentryClearUser = clearUser;

  // Auto-inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSentry);
  } else {
    initSentry();
  }
})();
