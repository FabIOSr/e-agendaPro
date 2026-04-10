# Tokens de Design — Tailwind CSS v4

> **Origem:** `AgendaPro_ColorSchema.html` — sistema de design existente
> **Objetivo:** Centralizar todos os tokens visuais em uma única configuração Tailwind

---

## 1. Filosofia

Os tokens atuais estão **duplicados** entre 14 arquivos HTML. Cada página tem seu bloco `:root` com as mesmas variáveis CSS. Tailwind resolve isso definindo tudo uma vez em `@theme`, com uso consistente via classes utilitárias.

---

## 2. `tailwind.config.js` — Tokens Mapeados

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.html',
    './modules/**/*.js',
    './modules/**/*.ts',
  ],
  theme: {
    extend: {
      // ── Cores do Painel (Dark Theme) ──
      colors: {
        // Fundo
        bg:       { DEFAULT: '#0e0d0a', 2: '#141310', 3: '#1c1a16', 4: '#242118' },
        // Borda
        bord:     { DEFAULT: '#2a2724', 2: '#383430' },
        // Texto
        text:     { DEFAULT: '#f0ede6', muted: '#8a8778', faint: '#3e3c36' },
        // Accent (lime — painel)
        lime:     { DEFAULT: '#c8f060', d: '#8ab830', ink: '#1a2a08', t: 'rgba(200,240,96,.1)' },

        // ── Cores da Página Pública (Light Theme) ──
        pagina:   { bg: '#faf9f6', bg2: '#f2f0ea' },
        border:   { DEFAULT: '#e4e0d6', 2: '#ccc8bc' },
        pagtext:  { DEFAULT: '#1a1a17', muted: '#7a7669', faint: '#b8b4a8' },
        accent:   { DEFAULT: '#2d5a27', l: '#eef4ec', m: '#c8dfc4' },
        warn:     { DEFAULT: '#8a4a10', l: '#fdf3ea' },

        // ── Rust (cancelar, destrutivo) ──
        rust:     { DEFAULT: '#c84830', t: 'rgba(200,72,48,.1)' },

        // ── Neutros úteis ──
        white:    '#ffffff',
        black:    '#000000',
      },

      // ── Tipografia ──
      fontFamily: {
        // Painel
        syne:     ["'Syne'", 'sans-serif'],
        fraunces: ["'Fraunces'", 'serif'],
        // Página pública
        'dm-sans':   ["'DM Sans'", 'sans-serif'],
        'instr-s':   ["'Instrument Serif'", 'serif'],
        // Compartilhado
        mono:     ["'DM Mono'", 'monospace'],
      },

      fontWeight: {
        regular: 400,
        medium:  500,
        semibold: 600,
        bold:    700,
      },

      // ── Border Radius ──
      borderRadius: {
        sm:   '4px',    // tags, badges pequenos
        md:   '8px',    // botões compactos, slots
        btn:  '10px',   // inputs, chips de horário
        card: '12px',   // cards do painel
        page: '14px',   // cards da página pública
        pill: '100px',  // pills, badges de plano
      },

      // ── Font Sizes (sistema tipográfico) ──
      fontSize: {
        'xs':   ['0.65rem', { lineHeight: '1rem', letterSpacing: '0.12em' }],     // labels uppercase
        'sm':   ['0.75rem', { lineHeight: '1rem' }],
        'base': ['0.875rem', { lineHeight: '1.25rem' }],
        'lg':   ['1rem', { lineHeight: '1.5rem' }],
        'xl':   ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl':  ['1.25rem', { lineHeight: '1.75rem' }],
        '3xl':  ['1.5rem', { lineHeight: '2rem' }],
        '4xl':  ['2rem', { lineHeight: '2.5rem' }],
      },

      // ── Spacing (escala consistente) ──
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      // ── Z-Index ──
      zIndex: {
        'toast': '9999',
        'modal': '9998',
        'dropdown': '100',
      },

      // ── Box Shadow ──
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)',
        'modal': '0 20px 60px rgba(0,0,0,0.3)',
        'glow-lime': '0 0 20px rgba(200,240,96,0.3)',
      },

      // ── Animation ──
      keyframes: {
        'slidein': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'fadein': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slidein': 'slidein 0.3s ease',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
        'fadein': 'fadein 0.2s ease',
      },
    },
  },
  plugins: [],
};
```

---

## 3. `src/styles/main.css` — Imports

```css
/* src/styles/main.css */
@import "tailwindcss";

@theme {
  /* Cores Painel (Dark) */
  --color-bg: #0e0d0a;
  --color-bg-2: #141310;
  --color-bg-3: #1c1a16;
  --color-bg-4: #242118;
  --color-bord: #2a2724;
  --color-bord-2: #383430;
  --color-text: #f0ede6;
  --color-text-muted: #8a8778;
  --color-text-faint: #3e3c36;
  --color-lime: #c8f060;
  --color-lime-d: #8ab830;
  --color-lime-ink: #1a2a08;
  --color-lime-t: rgba(200, 240, 96, 0.1);

  /* Cores Página Pública (Light) */
  --color-pagina-bg: #faf9f6;
  --color-pagina-bg2: #f2f0ea;
  --color-border: #e4e0d6;
  --color-border-2: #ccc8bc;
  --color-pagtext: #1a1a17;
  --color-pagtext-muted: #7a7669;
  --color-pagtext-faint: #b8b4a8;
  --color-accent: #2d5a27;
  --color-accent-l: #eef4ec;
  --color-accent-m: #c8dfc4;
  --color-warn: #8a4a10;
  --color-warn-l: #fdf3ea;

  /* Rust (destrutivo) */
  --color-rust: #c84830;
  --color-rust-t: rgba(200, 72, 48, 0.1);

  /* Fontes */
  --font-syne: 'Syne', sans-serif;
  --font-fraunces: 'Fraunces', serif;
  --font-dm-sans: 'DM Sans', sans-serif;
  --font-instr-s: 'Instrument Serif', serif;
  --font-mono: 'DM Mono', monospace;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-btn: 10px;
  --radius-card: 12px;
  --radius-page: 14px;
  --radius-pill: 100px;
}

/* ── Utilitários globais ── */
[x-cloak] { display: none !important; }

/* Toast (compatibilidade com ui-helpers.js) */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: var(--radius-btn);
  color: white;
  z-index: 9999;
  animation: slidein 0.3s ease;
}
.toast-success { background: var(--color-lime-d); }
.toast-error { background: var(--color-rust); }

/* Scrollbar custom (painel) */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--color-bg-2); }
::-webkit-scrollbar-thumb { background: var(--color-bord); border-radius: var(--radius-sm); }
::-webkit-scrollbar-thumb:hover { background: var(--color-bord-2); }
```

---

## 4. Migração de Variáveis CSS — Antes vs Depois

### Antes (configuracoes.html)

```css
:root {
  --bg: #0e0d0a;
  --bg2: #141310;
  --bg3: #1c1a16;
  --lime: #c8f060;
  --lime-d: #8ab830;
  --bord: #2a2724;
  --text: #f0ede6;
  --muted: #8a8778;
}
```

### Depois (Tailwind)

```html
<!-- Sem CSS custom — classes utilitárias diretas -->
<div class="bg-bg text-text">
  <button class="bg-lime text-lime-ink rounded-btn px-4 py-2">
    Salvar
  </button>
</div>
```

### Compatibilidade Durante Migração

Durante a migração, manter `@theme` **E** as variáveis `:root` simultaneamente. O Tailwind v4 mapeia `--color-*` automaticamente:

```css
/* main.css — período de transição */
@import "tailwindcss";

@theme {
  /* tokens tailwind */
}

/* Legado: manter variáveis para código não-migrado */
:root {
  --bg: #0e0d0a;
  --lime: #c8f060;
  /* ... existentes ... */
}
```

Quando toda a página for migrada, remover o bloco `:root` legado.

---

## 5. Accent Dinâmico (Cor de Tema do Profissional)

O professional com plano Pro pode ter uma cor de tema custom. Isso continua funcionando via JS:

```javascript
// pagina-cliente.html — após carregar dados do prestador
if (isPro && prestador.cor_tema) {
  const cor = prestador.cor_tema;
  document.documentElement.style.setProperty('--color-accent', cor);
  document.documentElement.style.setProperty('--color-accent-l', cor + '1a');
  document.documentElement.style.setProperty('--color-accent-m', cor + '4d');
}
```

Tailwind usa os valores do `@theme` como **padrão**. O `setProperty` sobrescreve no runtime — mesmo comportamento de hoje.

---

## 6. Classes Utilitárias Mais Usadas

### Painel (Dark)

| Elemento | Classe Tailwind |
|---|---|
| Fundo principal | `bg-bg text-text` |
| Card | `bg-bg-3 border border-bord rounded-card p-6` |
| Botão primário | `bg-lime text-lime-ink rounded-btn px-4 py-2 font-bold hover:bg-lime-d` |
| Botão destrutivo | `bg-rust text-white rounded-btn px-4 py-2 hover:opacity-90` |
| Input | `bg-bg-2 border border-bord rounded-btn px-3 py-2 text-text focus:border-lime-d outline-none` |
| Badge | `bg-lime-t text-lime rounded-pill px-2 py-0.5 text-xs` |
| Texto secundário | `text-text-muted` |
| Texto desabilitado | `text-text-faint` |

### Página Pública (Light)

| Elemento | Classe Tailwind |
|---|---|
| Fundo principal | `bg-pagina-bg text-pagtext` |
| Card serviço | `bg-white border border-border rounded-page p-4 hover:border-accent-m` |
| Botão CTA | `bg-accent text-white rounded-btn px-6 py-3 font-medium hover:opacity-90` |
| Badge Pro | `bg-accent-l text-accent rounded-pill px-2 py-0.5 text-xs` |
| Alerta | `bg-warn-l border border-warn text-warn rounded-btn p-3` |
| Preço | `font-mono text-accent font-medium` |

---

## 7. Checklist de Migração CSS

- [ ] Criar `tailwind.config.js` com todos os tokens
- [ ] Criar `src/styles/main.css` com `@import "tailwindcss"` + `@theme`
- [ ] Adicionar import no `config.js` ou no entry HTML base
- [ ] Manter `:root` variáveis para compatibilidade
- [ ] Migrar `landing-page.html` → classes Tailwind (primeira página)
- [ ] Migrar `configuracoes.html` → classes Tailwind
- [ ] Migrar `painel.html` → classes Tailwind
- [ ] Migrar `pagina-cliente.html` → classes Tailwind
- [ ] Remover `:root` variáveis de cada página migrada
- [ ] Verificar bundle CSS final com `npm run build -- --mode production`
- [ ] Confirmar que purge removeu classes não-usadas
