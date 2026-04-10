# Stack Frontend — Decisão Oficial

> **Data:** 2026-04-10
> **Status:** ✅ DECIDIDO — Esta é a stack oficial do projeto. Não discutir alternativas sem necessidade técnica comprovada.

---

## 1. Decisão Final

| Camada | Tecnologia | Versão | Versão Mínima |
|---|---|---|---|
| **Reatividade** | Alpine.js | 3.x | 3.14 |
| **CSS** | Tailwind CSS | 4.x | 4.0 |
| **Build Tool** | Vite | 6.x | 5.0 |
| **Type Safety** | JSDoc + `@ts-check` | — | — |
| **Gráficos** | Chart.js | 4.x | 4.4 |
| **Monitoramento** | Sentry | Browser SDK | — |
| **Analytics** | Plausible | Snippet | — |
| **Hosting** | Firebase Hosting | — | — |

**Runtime:** JavaScript vanilla + Alpine.js via npm (Vite) — sem CDN, sem JSX, sem bundler pesado.
**Build:** Vite para bundling, minificação, tree-shaking e Tailwind com purge automático.

---

## 2. O Que Foi Avaliado e Descartado

### ❌ Next.js / React

**Motivo da rejeição:**
- O AgendaPro é uma SPA simples com Firebase Hosting — não precisa de SSR, rotas de arquivo nem build pipeline pesado
- O projeto inteiro funciona com estado local simples — nenhuma tela tem complexidade que justifique o ecossistema React
- Trocar HTML direto por bundler + JSX + setup React adicionaria complexidade sem benefício real
- Next.js exigiria mudar de Firebase Hosting para Vercel/Node — quebra toda a infraestrutura atual

**Quando reconsiderar:** Se o produto evoluir para algo muito mais complexo com muitos estados compartilhados entre componentes e equipe > 2 devs.

### ❌ Astro

**Motivo da rejeição:**
- Astro é pensado para conteúdo/SEO — o AgendaPro não tem SEO como prioridade (páginas públicas já carregam via slug, sem necessidade de indexação orgânica pesada)
- Islands architecture é overkill para o nível de interatividade atual
- Migração de 6-8 semanas vs 2-3 semanas com Alpine
- Exigiria reescrever toda a estrutura de HTML em `.astro` — big bang desnecessário

**Quando reconsiderar:** Se SEO se tornar prioridade máxima (landing page de marketing separada com necessidade de ranking orgânico).

### ❌ Vue.js

**Motivo da rejeição:**
- Meio-termo entre Alpine e React que não entrega o melhor dos dois mundos para este contexto
- Mais pesado que Alpine, menos ecossistema que React
- Requer SFCs (`.vue` files) — quebra o modelo de HTML estático
- Nenhuma vantagem real sobre Alpine.js para o problema atual

### ❌ Svelte

**Motivo da rejeição:**
- Requer compilação — mesmo problema que Vue/React com SFCs
- Comunidade menor, risco de vendor lock-in mental
- Sem vantagem tangível sobre Alpine para interatividade declarativa

### ❌ Angular

**Motivo da rejeição:**
- Framework completo com curva de aprendizado alta
- Exagero total para o escopo do projeto
- Bundle pesado, complexidade desnecessária

---

## 3. Por Que Alpine.js + Tailwind + Vite

### Alpine.js — Reatividade Sem Complexidade

- **Modelo mental familiar:** `x-data`, `x-show`, `x-bind`, `x-on` — funciona direto no HTML sem mudar a forma de pensar
- **Migração incremental:** Substituir `document.getElementById` e `renderX()` por diretivas Alpine, página por página, sem big bang
- **15kb gzipped** — mínimo impacto no bundle
- **npm + Vite** — versionado no `package.json`, sem risco de CDN cair ou mudar versão
- **Compatível com HTML estático** — mantém o deploy simples via Firebase Hosting

### Tailwind CSS v4 — Consistência de Design

- **Resolve problema real:** CSS crescendo sem controle, variáveis duplicadas entre painel (dark) e página pública (light)
- **Tokens centralizados:** Cores, raios, tipografia definidos uma vez em `tailwind.config`, usados em todas as páginas
- **Purge automático:** Com Vite, só o CSS usado vai para o bundle final (~10-15KB vs ~300KB do CDN mode)
- **Design system natural:** `@theme` do Tailwind v4 mapeia diretamente os tokens existentes do AgendaPro
- **Responsividade consistente:** Breakpoints padronizados em todo o app

### Vite — Build Step Leve e Necessário

- **Minificação automática** — arquivos JS/CSS vão comprimidos para produção
- **Tree-shaking** — módulos importados parcialmente, não inteiros
- **Tailwind com purge** — sem Vite, Tailwind CDN serve ~300KB não comprimido
- **Dev server com HMR** — hot reload real, sem recarregar a página a cada mudança
- **Zero configuração complexa** — `vite.config.js` simples, sem plugins pesados
- **Mantém Firebase Hosting** — build gera `dist/` estático, mesmo deploy de sempre

---

## 4. Bibliotecas Aprovadas

Estas são as bibliotecas de terceiros autorizadas no frontend. Adicionar novas requer justificativa técnica.

| Biblioteca | Uso | Tamanho | Import |
|---|---|---|---|
| **Alpine.js** | Reatividade declarativa | 15kb gz | CDN ou npm |
| **Chart.js** | Gráficos (relatórios, dashboard admin) | 60kb gz | npm via Vite |
| **Tailwind CSS** | Sistema de design | ~12kb gz (purged) | npm via Vite |
| **Sentry Browser** | Monitoramento de erros | ~30kb gz | CDN dinâmico |
| **Plausible** | Analytics privacy-first | <1kb | Snippet inline |
| **Supabase JS** | Cliente do banco | ~50kb gz | npm via Vite |

### ❌ Bibliotecas Expressamente Não Aprovadas

| Biblioteca | Motivo |
|---|---|
| React / ReactDOM | Overkill, 150kb+, requer JSX |
| Vue | 100kb+, requer SFCs |
| jQuery | Antipadrão, Alpine já resolve |
| Lodash | Tree-shaking do Vite + vanilla JS resolve |
| Moment.js | 300kb, usar `Intl.DateTimeFormat` nativo |
| Bootstrap | Conflito com Tailwind, CSS pesado |

---

## 5. Arquitetura Pós-Migração

```
agendapro/
├── src/                          ← Novo: código fonte
│   ├── pages/                    ← HTML migrado para Vite entries
│   ├── styles/
│   │   └── main.css             ← Tailwind imports + tokens custom
│   ├── modules/                  ← JS atual (mantido)
│   └── components/               ← Alpine components futuros
│
├── vite.config.js                ← Config do Vite
├── tailwind.config.js            ← Tokens de design centralizados
├── postcss.config.js             ← PostCSS para Tailwind
│
├── dist/                         ← Gerado pelo build (mesmo de hoje)
│   ├── pages/
│   ├── modules/
│   └── config.js
│
└── docs/stack/                   ← Esta documentação
    ├── STACK-DECISION.md         ← Este arquivo (DECISÃO OFICIAL)
    ├── ALPINE-GUIDE.md           ← Guia prático de Alpine.js
    ├── VITE-CONFIG.md            ← Configuração do Vite
    ├── TAILWIND-TOKENS.md        ← Tokens de design mapeados
    ├── BIBLIOTECAS-LOCAIS.md     ← Lista de libs aprovadas
    └── MIGRACAO-PLANO.md         ← Plano de migração página a página
```

**Nota:** Durante a migração, a estrutura atual (`pages/`, `modules/`, `config.js`) convive com o novo setup Vite. O `dist/` final permanece idêntico — Firebase Hosting não precisa de mudanças.

---

## 6. Princípios da Migração

1. **Sem big bang** — Página por página, sem parar o produto
2. **Sem reescrita total** — JS vanilla funciona, Alpine complementa
3. **Build step mínimo** — Vite configura uma vez, esquece
4. **CSS centralizado** — Tokens de design definidos uma vez, usados em todo lugar
5. **Mantém compatibilidade** — `dist/` final é estático, mesmo deploy de sempre
6. **Testes preservados** — 177 testes continuam passando após cada migração de página

---

## 7. Gatilhos para Reavaliação

Esta decisão é válida até que **um ou mais** destes gatilhos ocorram:

| Gatilho | Ação Sugerida |
|---|---|
| > 500 profissionais ativos pagantes | Avaliar Astro para landing page de marketing |
| Funcionalidades complexas de UI (drag-and-drop, canvas) | Avaliar React + shadcn/ui para essas telas específicas |
| Equipe > 2 devs | Framework com mais estrutura pode fazer sentido |
| SEO se torna prioridade | Migrar landing page para Astro, manter resto |
| App mobile necessário | Avaliar PWA com Workbox ou React Native |

---

## 8. Histórico de Decisões Anteriores

Documentos anteriores que discutiam alternativas (Astro, React, Vue) foram **arquivados** e não representam mais a direção do projeto. Eles permanecem em `docs/sugestoes/` apenas como referência histórica.

| Arquivo Antigo | Status |
|---|---|
| `docs/sugestoes/migracao-astro/*` | 📁 Arquivado — não seguir |
| `docs/sugestoes/migracao-alpine-tailwind/*` | 📁 Arquivado — parcialmente útil como guia |
| `docs/admin/STACK-MODERNIZACAO.md` | 📁 Arquivado — decisões consolidadas neste doc |

**Este documento (`docs/stack/STACK-DECISION.md`) é a única fonte de verdade para decisões de stack frontend.**
