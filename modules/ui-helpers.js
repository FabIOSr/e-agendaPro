// modules/ui-helpers.js
// Helpers de UI reutilizáveis para todas as páginas do AgendaPro

/**
 * Exibe notificação toast temporária
 * @param {string} message - Mensagem a exibir
 * @param {boolean|string} type - true/'success' = sucesso, false/'error' = erro, 'warning', 'info'
 * @param {number} duration - Duração em milissegundos (padrão: 3000)
 */
function toast(message, type = 'success', duration = 3000) {
  // Remove toast anterior se existir
  const existing = document.getElementById('toast-notification');
  if (existing) {
    existing.remove();
  }

  // Cria elemento do toast
  const toastEl = document.createElement('div');
  toastEl.id = 'toast-notification';
  
  // Normaliza tipo (aceita booleano ou string)
  let typeStr = type;
  if (type === true) typeStr = 'success';
  if (type === false) typeStr = 'error';
  
  // A mensagem já vem com o ícone embutido (ex: '✓ Salvo!')
  toastEl.textContent = message;
  
  // Cores por tipo
  const colors = {
    success: '#8ab830',
    error: '#c84830',
    warning: '#f0a060',
    info: '#60b0f0'
  };
  
  // Estilos CSS inline - Toast centralizado no topo
  toastEl.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    background: ${colors[typeStr] || colors.success};
    color: white;
    border-radius: 6px;
    font-weight: 500;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    animation: toast-slidein 0.3s ease;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 90vw;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
  `;

  document.body.appendChild(toastEl);
  
  // Fade in após adicionar
  requestAnimationFrame(() => {
    toastEl.style.opacity = '1';
  });
  
  // Remove após duração com fade out
  setTimeout(() => {
    toastEl.style.animation = 'toast-slideout 0.3s ease';
    toastEl.style.opacity = '0';
    setTimeout(() => toastEl.remove(), 300);
  }, duration);
}

/**
 * Exibe toast com botão de desfazer
 * @param {string} message - Mensagem
 * @param {Function} onUndo - Callback ao clicar em desfazer
 * @param {number} duration - Duração em ms (padrão: 5000)
 */
function toastWithUndo(message, onUndo, duration = 5000) {
  // Remove toast anterior
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'toast-notification';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
    z-index: 9999;
    animation: toast-slidein 0.3s ease;
  `;

  const toastEl = document.createElement('div');
  toastEl.textContent = message;
  toastEl.style.cssText = `
    padding: 12px 20px;
    background: #8ab830;
    color: white;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;

  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Desfazer';
  undoBtn.style.cssText = `
    padding: 12px 20px;
    background: white;
    color: #8ab830;
    border: 2px solid #8ab830;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  undoBtn.onmouseover = () => {
    undoBtn.style.background = '#8ab830';
    undoBtn.style.color = 'white';
  };
  undoBtn.onmouseout = () => {
    undoBtn.style.background = 'white';
    undoBtn.style.color = '#8ab830';
  };
  undoBtn.onclick = () => {
    onUndo();
    container.remove();
  };

  container.appendChild(toastEl);
  container.appendChild(undoBtn);
  document.body.appendChild(container);

  setTimeout(() => {
    container.style.animation = 'toast-slideout 0.3s ease';
    setTimeout(() => container.remove(), 300);
  }, duration);
}

/**
 * Mostra modal de confirmação
 * @param {string} title - Título do modal
 * @param {string} message - Mensagem de confirmação
 * @returns {Promise<boolean>} true = confirmado, false = cancelado
 */
function confirmModal(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadein 0.2s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 12px 0; color: #0e0d0a; font-size: 18px;">${title}</h3>
      <p style="margin: 0 0 24px 0; color: #6b6860; font-size: 14px; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="modal-cancel" style="
          padding: 10px 20px;
          background: #f5f2eb;
          color: #6b6860;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        ">Cancelar</button>
        <button id="modal-confirm" style="
          padding: 10px 20px;
          background: #c84830;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        ">Confirmar</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handlers
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    const cleanup = () => {
      cancelBtn?.remove();
      confirmBtn?.remove();
      modal.remove();
      overlay.remove();
    };

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    confirmBtn?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    // Fecha ao clicar fora
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });
  });
}

// Adiciona animações CSS globalmente (uma vez só)
if (typeof document !== 'undefined' && !document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes toast-slidein {
      from { transform: translateX(-50%) translateY(-10px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes toast-slideout {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(-10px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Exporta globalmente para window (padrão vanilla JS)
if (typeof window !== 'undefined') {
  window.toast = toast;
  window.toastWithUndo = toastWithUndo;
  window.confirmModal = confirmModal;
}
