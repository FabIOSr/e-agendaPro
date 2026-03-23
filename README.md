# AgendaPro — Documentação completa do projeto

> App de agendamento para profissionais autônomos brasileiros.
> Stack: Firebase Hosting (front) · Supabase (banco, auth, Edge Functions) · Asaas (pagamentos) · Z-API (WhatsApp)

---

## Índice

1. [Arquitetura geral](#arquitetura)
2. [Banco de dados](#banco)
3. [Edge Functions](#edge-functions)
4. [Telas e páginas](#telas)
5. [Fluxo completo de agendamento](#fluxo)
6. [Sistema de planos](#planos)
7. [Integrações externas](#integracoes)
8. [Deploy passo a passo](#deploy)
9. [Variáveis de ambiente](#env)
10. [Checklist de lançamento](#checklist)

---

## 1. Arquitetura geral {#arquitetura}

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE FINAL                        │
│  agendapro.com.br/ana-cabelos  (página pública de booking)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST agendamento
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       FIREBASE HOSTING                      │
│  • Landing page          • Painel do prestador              │
│  • Onboarding            • Configurações                    │
│  • Auth (login/cadastro) • Relatórios + Histórico           │
│  • Página pública cliente                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ Supabase JS Client (JWT auth)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         SUPABASE                            │
│                                                             │
│  Auth ──────────► prestadores (trigger auto-cria perfil)   │
│                                                             │
│  PostgreSQL                                                 │
│  • prestadores        • servicos        • disponibilidade   │
│  • agendamentos       • bloqueios       • pagamentos        │
│  • avaliacoes         • google_calendar_tokens              │
│                                                             │
│  Edge Functions (Deno)                                      │
│  • horarios-disponiveis      • criar-assinatura             │
│  • lembretes-whatsapp        • webhook-asaas                │
│  • cancelar-assinatura       • cancelar-agendamento-cliente │
│  • reagendar-cliente         • avaliacoes                   │
│  • google-calendar-sync                                     │
│                                                             │
│  Cron Jobs                                                  │
│  • 21:00 UTC → lembrete-d1                                  │
│  • 03:00 UTC → downgrade-planos-vencidos                    │
│  • */60 min  → solicitar-avaliacoes                         │
└──────────┬───────────────┬──────────────────────────────────┘
           │               │
           ▼               ▼
       Z-API           ASAAS
    (WhatsApp)      (Pagamentos)
           │               │
           │    webhook     │
           └───────────────┘
                   │
                   ▼
         Google Calendar API
```

---

## 2. Banco de dados {#banco}

### Tabelas principais

```sql
-- Perfil do profissional (sincronizado com auth.users)
prestadores (
  id uuid PK,             -- = auth.users.id
  nome text,
  slug text UNIQUE,       -- "ana-cabelos"
  email text,
  bio text,
  foto_url text,
  whatsapp text,
  plano text,             -- 'free' | 'pro'
  plano_valido_ate timestamptz,
  trial_usado boolean,
  asaas_customer_id text,
  asaas_sub_id text,
  google_event_id text
)

-- Serviços oferecidos
servicos (
  id uuid PK,
  prestador_id uuid FK,
  nome text,
  duracao_min int,
  preco numeric,
  ativo boolean
)

-- Disponibilidade semanal
disponibilidade (
  id uuid PK,
  prestador_id uuid FK,
  dia_semana int,         -- 0=Dom .. 6=Sáb
  hora_inicio time,
  hora_fim time
)

-- Bloqueios pontuais
bloqueios (
  id uuid PK,
  prestador_id uuid FK,
  inicio timestamptz,
  fim timestamptz,
  motivo text
)

-- Agendamentos
agendamentos (
  id uuid PK,
  prestador_id uuid FK,
  servico_id uuid FK,
  data_hora timestamptz,
  cliente_nome text,
  cliente_tel text,
  status text,            -- 'confirmado' | 'concluido' | 'cancelado'
  cancel_token text UNIQUE DEFAULT gen_random_uuid(),
  google_event_id text,
  created_at timestamptz
)

-- Pagamentos / histórico Asaas
pagamentos (
  id uuid PK,
  prestador_id uuid FK,
  asaas_payment_id text UNIQUE,
  evento text,
  valor numeric,
  billing_type text,
  data_evento timestamptz,
  payload jsonb
)

-- Avaliações pós-atendimento
avaliacoes (
  id uuid PK,
  agendamento_id uuid FK UNIQUE,
  prestador_id uuid FK,
  cliente_nome text,
  nota smallint,          -- 1..5
  comentario text,
  created_at timestamptz
)

-- Tokens Google Calendar
google_calendar_tokens (
  prestador_id uuid PK FK,
  access_token text,
  refresh_token text,
  expires_at timestamptz
)
```

### Migrations (ordem de execução)

```
1. auth-migration.sql           → tabela prestadores + trigger + RLS
2. migration.sql                → tabela pagamentos + colunas Asaas
3. cron-downgrade.sql           → cron + função verifica_plano_ativo
4. cancel-token-migration.sql   → cancel_token em agendamentos
5. nice-migration.sql           → avaliacoes + google_calendar_tokens
```

---

## 3. Edge Functions {#edge-functions}

| Função | Método | Auth | Descrição |
|---|---|---|---|
| `horarios-disponiveis` | POST | público | Calcula slots livres por data/serviço, descontando bloqueios e agendamentos |
| `lembretes-whatsapp` | POST | service_role | Confirmação imediata e lembrete D-1 via Z-API |
| `criar-assinatura` | POST | JWT prestador | Cria cliente e assinatura no Asaas |
| `webhook-asaas` | POST | token header | Ativa/desativa plano Pro ao receber eventos do Asaas |
| `cancelar-assinatura` | POST | JWT prestador | Cancela assinatura no Asaas mantendo acesso até fim do período |
| `cancelar-agendamento-cliente` | GET/POST | token URL | Página HTML + execução de cancelamento pelo cliente |
| `reagendar-cliente` | GET/POST | token URL | Página HTML + execução de reagendamento pelo cliente |
| `avaliacoes` | GET/POST | token URL / público | Página de avaliação + API pública de reviews |
| `google-calendar-sync` | GET/POST | OAuth / JWT | Conecta Calendar e sincroniza criação/edição/cancelamento |

### Deploy de todas as funções

```bash
for fn in horarios-disponiveis lembretes-whatsapp criar-assinatura \
          webhook-asaas cancelar-assinatura cancelar-agendamento-cliente \
          reagendar-cliente avaliacoes google-calendar-sync; do
  supabase functions deploy $fn
done
```

---

## 4. Telas e páginas {#telas}

| Arquivo | Rota | Acesso |
|---|---|---|
| `landing-page/index.html` | `/` | público |
| `auth/auth.html` | `/auth` | público |
| `onboarding/index.html` | `/onboarding` | JWT |
| `painel-prestador/index.html` | `/painel` | JWT |
| `relatorio-clientes/index.html` | `/relatorios` | JWT + Pro |
| `assinaturas/tela-planos/index.html` | `/planos` | JWT |
| `cancelamento-config/configuracoes/index.html` | `/configuracoes` | JWT |
| `pagina-cliente/index.html` | `/:slug` | público |

### Proteção de rotas

Toda página protegida importa `painel-init.js` que:
1. Chama `requireAuth()` — redireciona para `/auth` se sem sessão
2. Chama `watchSession()` — detecta logout em outras abas
3. Expõe `exigirPro(elementId, nomeFuncao)` — gate inline para funcionalidades Pro

---

## 5. Fluxo completo de agendamento {#fluxo}

```
Cliente acessa agendapro.com.br/ana-cabelos
    │
    ├─ Escolhe serviço
    ├─ Escolhe data (calendário)
    ├─ Busca slots → POST /horarios-disponiveis
    ├─ Escolhe horário
    ├─ Informa nome e telefone
    └─ Confirma
         │
         ├─ INSERT agendamentos (cancel_token gerado automaticamente)
         ├─ POST /lembretes-whatsapp { tipo: "confirmacao", agendamento_id }
         │    ├─ WhatsApp para cliente (confirmação + link cancelar + link remarcar)
         │    └─ WhatsApp para prestador (novo agendamento)
         └─ POST /google-calendar-sync { action: "criar", agendamento_id }
              └─ Cria evento no Google Calendar do prestador

Às 18h do dia anterior (cron):
    └─ POST /lembretes-whatsapp { tipo: "lembrete_d1" }
         ├─ WhatsApp para cada cliente com agendamento amanhã
         └─ WhatsApp para prestador com resumo do dia

2h após conclusão (cron a cada hora):
    └─ POST /avaliacoes → WhatsApp com link de avaliação

Cliente cancela via link no WhatsApp:
    └─ GET /cancelar-agendamento-cliente?token=xxx
         ├─ Mostra página de confirmação
         └─ POST com token → UPDATE status='cancelado'
              ├─ WhatsApp para prestador
              └─ DELETE evento do Google Calendar

Cliente remarcar via link no WhatsApp:
    └─ GET /reagendar-cliente?token=xxx
         ├─ Mostra calendário com slots disponíveis
         └─ POST { token, data, hora } → UPDATE data_hora
              ├─ WhatsApp para cliente e prestador
              └─ PATCH evento no Google Calendar
```

---

## 6. Sistema de planos {#planos}

### Limites por plano

| Funcionalidade | Free | Pro |
|---|---|---|
| Agendamentos/mês | 10 | Ilimitado |
| WhatsApp automático | ✗ | ✓ |
| Lembrete D-1 | ✗ | ✓ |
| Histórico de clientes | ✗ | ✓ |
| Relatório de receita | ✗ | ✓ |
| Avaliações | ✓ | ✓ |
| Google Calendar | ✗ | ✓ |
| Cancelamento/reagendamento cliente | ✓ | ✓ |

### Ciclo de vida do plano

```
Cadastro → plano='free'
    │
    └─ Assina → POST /criar-assinatura
                    └─ Asaas cria assinatura
                         │
                         └─ Webhook PAYMENT_RECEIVED
                              └─ UPDATE plano='pro', plano_valido_ate=+30d

Pagamento vence:
    PAYMENT_OVERDUE → grace period 3 dias (plano continua ativo)
    Cron 03h → se plano_valido_ate < NOW()-3d → UPDATE plano='free'

Cancela → DELETE /assinatura no Asaas
    └─ plano mantém 'pro' até plano_valido_ate
         └─ Cron faz downgrade automaticamente
```

---

## 7. Integrações externas {#integracoes}

### Z-API (WhatsApp)
- Criar conta em z-api.io
- Criar instância e conectar número dedicado (chip separado)
- Configurar em Secrets: `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`
- Rate limit: respeitar 1.5s entre envios no lembrete D-1

### Asaas (Pagamentos)
- Criar conta em asaas.com (pessoa jurídica)
- Obter API Key em Minha Conta → Integrações
- Configurar webhook: URL da Edge Function `webhook-asaas`
- Token de segurança do webhook em `ASAAS_WEBHOOK_TOKEN`
- Usar sandbox para testes: `sandbox.asaas.com/api/v3`

### Google Calendar
- Criar projeto no Google Cloud Console
- Habilitar Calendar API
- Criar OAuth 2.0 Client ID (tipo: Web Application)
- Adicionar URI de redirecionamento: `{SUPABASE_URL}/functions/v1/google-calendar-sync?action=callback`
- Configurar: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

## 8. Deploy passo a passo {#deploy}

```bash
# 1. SUPABASE — criar projeto em supabase.com

# 2. BANCO — rodar migrations (SQL Editor do painel)
#    auth-migration.sql
#    migration.sql
#    cron-downgrade.sql
#    cancel-token-migration.sql
#    nice-migration.sql

# 3. AUTH — configurar no painel Supabase
#    Auth → Providers → Google: adicionar Client ID e Secret
#    Auth → URL Configuration:
#      Site URL: https://seuapp.com
#      Redirect URLs: https://seuapp.com/painel
#                     https://seuapp.com/auth

# 4. EDGE FUNCTIONS — deploy
supabase login
supabase link --project-ref SEU_PROJECT_REF

for fn in horarios-disponiveis lembretes-whatsapp criar-assinatura \
          webhook-asaas cancelar-assinatura cancelar-agendamento-cliente \
          reagendar-cliente avaliacoes google-calendar-sync; do
  supabase functions deploy $fn
done

# 5. SECRETS
supabase secrets set \
  ZAPI_INSTANCE_ID="xxx" \
  ZAPI_TOKEN="xxx" \
  ZAPI_CLIENT_TOKEN="xxx" \
  ASAAS_API_KEY="$aas_xxx" \
  ASAAS_WEBHOOK_TOKEN="token-secreto" \
  GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="xxx" \
  APP_URL="https://seuapp.com"

# 6. ASAAS — configurar webhook
#    Minha Conta → Integrações → Webhooks
#    URL: https://SEU_PROJETO.supabase.co/functions/v1/webhook-asaas
#    Token: valor de ASAAS_WEBHOOK_TOKEN

# 7. FIREBASE HOSTING — deploy do front
npm install -g firebase-tools
firebase login
firebase init hosting
# public dir: . (ou /dist se usar build)
firebase deploy --only hosting

# 8. VARIÁVEIS NO FRONT
#    Substituir em auth.html e auth-session.js:
#    SUPABASE_URL  = https://SEU_PROJETO.supabase.co
#    SUPABASE_ANON = sua_anon_key_publica
```

---

## 9. Variáveis de ambiente {#env}

| Variável | Onde usar | Descrição |
|---|---|---|
| `SUPABASE_URL` | Edge Functions (auto) | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (auto) | Chave de serviço (nunca expor no front) |
| `SUPABASE_ANON_KEY` | Front-end (público) | Chave anônima para o JS client |
| `ZAPI_INSTANCE_ID` | Edge Functions | ID da instância Z-API |
| `ZAPI_TOKEN` | Edge Functions | Token de autenticação Z-API |
| `ZAPI_CLIENT_TOKEN` | Edge Functions | Client-Token do header Z-API |
| `ASAAS_API_KEY` | Edge Functions | API Key do Asaas |
| `ASAAS_WEBHOOK_TOKEN` | Edge Functions | Token de validação dos webhooks |
| `GOOGLE_CLIENT_ID` | Edge Functions | OAuth Client ID do Google |
| `GOOGLE_CLIENT_SECRET` | Edge Functions | OAuth Client Secret do Google |
| `APP_URL` | Edge Functions | URL pública do app (para links WhatsApp) |

---

## 10. Checklist de lançamento {#checklist}

### Banco e auth
- [ ] Todas as 5 migrations rodadas em ordem
- [ ] Trigger `on_auth_user_created` funcionando (teste: criar usuário e ver linha em `prestadores`)
- [ ] RLS testada: usuário A não acessa dados do usuário B
- [ ] Google OAuth configurado e testado
- [ ] Cron jobs ativos: `downgrade-planos-vencidos`, `lembrete-d1`, `solicitar-avaliacoes`

### Edge Functions
- [ ] `horarios-disponiveis` → testa conflito com bloqueio e agendamento
- [ ] `lembretes-whatsapp` → testa confirmação e lembrete D-1 em sandbox
- [ ] `webhook-asaas` → testa com sandbox do Asaas (PAYMENT_RECEIVED ativa pro)
- [ ] `cancelar-agendamento-cliente` → GET renderiza página, POST cancela
- [ ] `reagendar-cliente` → seleciona novo horário e atualiza
- [ ] `avaliacoes` → envia, bloqueia dupla avaliação
- [ ] `google-calendar-sync` → fluxo OAuth completo + criar/deletar evento

### Pagamentos
- [ ] Fluxo completo testado no sandbox Asaas (Pix + Cartão)
- [ ] Webhook recebendo eventos corretamente
- [ ] Downgrade automático funcionando após vencimento

### Front-end
- [ ] Login, cadastro, recuperação de senha funcionando
- [ ] Onboarding cria perfil em `prestadores` corretamente
- [ ] Gate de plano bloqueia Relatórios e Histórico no free
- [ ] Paywall exibe e redireciona para `/planos`
- [ ] Página pública carrega corretamente sem auth

### Pré-lançamento
- [ ] Testar fluxo completo de ponta a ponta com número real de WhatsApp
- [ ] Configurar domínio personalizado no Firebase Hosting
- [ ] Ativar SSL/HTTPS
- [ ] Configurar Google Analytics ou Plausible
- [ ] Criar 5 contas de teste com diferentes cenários
- [ ] Definir SLA de suporte (WhatsApp de suporte, tempo de resposta)

---

## Estrutura de arquivos entregues

```
agendapro/
│
├── auth/
│   ├── auth.html              ← Login, cadastro, recuperação de senha
│   ├── auth-session.js        ← Módulo de sessão reutilizável
│   ├── painel-init.js         ← Proteção de rotas + gate de plano
│   └── auth-migration.sql     ← Trigger de perfil + RLS
│
├── supabase/functions/
│   ├── horarios-disponiveis/index.ts
│   ├── lembretes-whatsapp/index.ts
│   ├── criar-assinatura/index.ts
│   ├── webhook-asaas/index.ts
│   ├── cancelar-assinatura/index.ts
│   ├── cancelar-agendamento-cliente/index.ts
│   ├── reagendar-cliente/index.ts
│   ├── avaliacoes/index.ts
│   └── google-calendar-sync/index.ts
│
├── migrations/
│   ├── auth-migration.sql
│   ├── migration.sql
│   ├── cron-downgrade.sql
│   ├── cancel-token-migration.sql
│   └── nice-migration.sql
│
├── pages/
│   ├── landing-page/index.html
│   ├── onboarding/index.html
│   ├── painel-prestador/index.html
│   ├── pagina-cliente/index.html
│   ├── relatorio-clientes/index.html
│   ├── configuracoes/index.html
│   └── assinaturas/tela-planos/index.html
│
└── README.md                  ← este arquivo
```

---

*Projeto completo desenvolvido com Stitch / Firebase Studio (front) + Supabase (back) + Asaas (pagamentos) + Z-API (WhatsApp).*
