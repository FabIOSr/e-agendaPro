# AgendaPro — Product Requirements Document
**Versão:** 1.0  
**Data:** Abril 2026  
**Status:** Em desenvolvimento ativo

---

## 1. Visão do Produto

AgendaPro é uma plataforma SaaS de agendamento online voltada para profissionais de beleza brasileiros — manicures, extensionistas de cílios, designers de sobrancelha, esteticistas, cabeleireiros, depiladoras e massagistas. O produto permite que esses profissionais recebam agendamentos online através de uma página pública personalizada, sem depender de WhatsApp manual ou agenda em papel.

### Proposta de valor central
- **Para o profissional:** agenda online profissional em minutos, sem conhecimento técnico
- **Para o cliente final:** experiência de agendamento simples, direta, pelo celular
- **Para o AgendaPro:** aquisição orgânica passiva via rodapé da página pública

### URL do produto
`https://e-agendapro.web.app`

---

## 2. Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML/CSS/JS — Firebase Hosting |
| Backend | Supabase (PostgreSQL + Edge Functions em Deno/TypeScript) |
| Pagamentos | Asaas |
| WhatsApp | Evolution API |
| Email | SendGrid |
| Calendário | Google Calendar OAuth |
| Monitoramento | Sentry |

---

## 3. Arquitetura de Planos

### Plano Free
- Até **30 agendamentos por mês**
- Página pública funcional (serviços → calendário → slots → formulário → confirmação)
- Avatar/foto, nome e bio
- Localização no hero (cidade ou `local_exibicao`)
- Horário de funcionamento agrupado no hero
- Descrição dos serviços
- Toggle exibir/ocultar preço por serviço
- Rodapé "Agendamento por AgendaPro" (link de aquisição)
- Banner de limite atingido com botão WhatsApp do prestador

### Plano Pro
Tudo do Free, mais:
- **Cor de tema personalizada** — aplicada em hero gradient, botões, preços, badges, bordas, estrelas de avaliação, títulos de seção
- **Localização expandida** — endereço completo (rua e número)
- **Rating no hero** — média + total de avaliações
- **Badge "Próximo horário disponível"** — busca os próximos 7 dias, exibe primeiro slot livre com ponto verde pulsante
- **Seção de avaliações** — últimas 3 com comentário, avatar, data e estrelas
- **Galeria de fotos** — até 9 imagens via URLs externas (Google Fotos etc.), grid 3×3
- **CTA de upgrade na própria página** — banner visível somente para o dono logado no Free, com modo preview Pro ativável

---

## 4. Páginas e Funcionalidades

### 4.1 Página Pública (`/[slug]`)

Página de agendamento do profissional, acessível por qualquer pessoa sem login.

**Fluxo de agendamento (5 steps):**
1. Escolha do serviço
2. Escolha da data (calendário mensal)
3. Escolha do horário (slots via Edge Function `horarios-disponiveis`)
4. Dados do cliente (nome, WhatsApp, email opcional)
5. Resumo + confirmação

**Regras técnicas críticas:**
- Timezone sempre explícito como `-03:00` (BRT). Nunca usar `toISOString()` diretamente em datas locais
- `isPro` declarado uma única vez em `carregarPrestador()`, nunca redeclarado
- Cache de slots invalidado ao confirmar agendamento
- Slug único por profissional — Free e Pro usam a mesma URL, renderização bifurca no JS

**Detecção de plano:**
```javascript
const isPro = data.plano === 'pro'
  && data.plano_valido_ate
  && new Date(data.plano_valido_ate) > new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
```
O grace period de 3 dias evita que o Pro perca acesso imediatamente após vencimento.

**Features adicionais da página:**
- Lista de espera: quando não há slots disponíveis, cliente pode entrar em lista com preferência de horário (exato, período ou qualquer)
- Limite free: consulta contagem de agendamentos do mês, exibe banner se ≥ 30
- Horário de funcionamento: lê tabela `disponibilidade`, agrupa dias consecutivos com mesmo horário, exibe como `Seg–Sex 9h–18h · Sáb 9h–13h`

**CTA de upgrade (para o dono logado Free):**
- Detecta sessão Supabase Auth silenciosamente
- Compara slug da página com slug do usuário logado
- Se coincidir e plano for Free: exibe banner escuro no topo
- Botão "Ver no Pro →" ativa modo preview: carrega avaliações reais, próximo slot real, galeria real, cor de tema existente
- Botão "Sair do preview" reverte tudo ao estado Free

### 4.2 Painel de Configurações (`/configuracoes`)

Acesso restrito ao profissional autenticado.

**Seções:**
- **Meu perfil:** nome, slug, foto (upload para Supabase Storage), bio, cidade, endereço, local de exibição, categoria, cor de tema
- **Serviços:** lista editável com nome, duração, preço, descrição (máx. 120 chars), toggle exibir preço, toggle ativo/inativo
- **Galeria:** até 9 URLs de imagens externas (só Pro; Free vê mensagem de bloqueio)
- **Agenda:** dias de atendimento, horários por dia, bloqueios pontuais e recorrentes
- **Notificações:** preferências de WhatsApp/email
- **Plano:** visão do plano atual, limites, histórico
- **Google Calendar:** OAuth para sincronização bidirecional
- **Senha / Conta**

### 4.3 Autenticação (`/auth`)
Login/cadastro via Supabase Auth. Redireciona para `/configuracoes` após login.

---

## 5. Modelo de Dados (principais tabelas)

### `prestadores`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| nome | text | Nome do profissional |
| slug | text | URL única da página pública |
| bio | text | Descrição curta |
| foto_url | text | URL da foto de perfil |
| whatsapp | text | Número com DDI |
| cidade | text | Cidade |
| endereco | text | Endereço completo |
| local_exibicao | text | Texto exibido no hero público |
| categoria | text | Categoria do profissional |
| cor_tema | text | Hex da cor de tema (#RRGGBB) |
| galeria_urls | text[] | Array de URLs de imagens |
| plano | text | 'free' ou 'pro' |
| plano_valido_ate | timestamptz | Data de vencimento do Pro |
| trial_ends_at | timestamptz | Data de fim do trial |
| intervalo_min | integer | Buffer entre agendamentos (min) |
| intervalo_slot | integer | Intervalo de exibição de slots (min) |

### `servicos`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| prestador_id | uuid | FK prestadores |
| nome | text | Nome do serviço |
| duracao_min | integer | Duração em minutos |
| preco | numeric | Preço |
| descricao | text | Descrição curta (máx. 120 chars) |
| exibir_preco | boolean | Se false, exibe "Sob consulta" |
| ativo | boolean | Visível na página pública |

### `disponibilidade`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| prestador_id | uuid | FK prestadores |
| dia_semana | integer | 0=Dom … 6=Sáb |
| hora_inicio | time | Início do atendimento |
| hora_fim | time | Fim do atendimento |

### `agendamentos`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| prestador_id | uuid | FK prestadores |
| servico_id | uuid | FK servicos |
| cliente_nome | text | Nome do cliente |
| cliente_tel | text | WhatsApp do cliente |
| cliente_email | text | Email (opcional) |
| data_hora | timestamptz | Data/hora em UTC |
| status | text | 'confirmado', 'cancelado', 'concluido' |

### `bloqueios`
Bloqueios pontuais de horário (ex: compromisso pessoal).

### `bloqueios_recorrentes`
Bloqueios fixos semanais (ex: almoço toda segunda).

### `lista_espera`
Clientes que querem ser notificados se um horário surgir.

---

## 6. Edge Functions (Supabase)

| Função | Descrição |
|--------|-----------|
| `horarios-disponiveis` | Retorna slots livres para um serviço/data. Considera agendamentos, bloqueios e buffer entre atendimentos |
| `criar-agendamento` | Valida disponibilidade e cria agendamento. Aplica limite free (30/mês) |
| `lembretes-whatsapp` | Envia confirmações e lembretes via Evolution API |
| `avaliacoes` | Retorna média, total e lista de avaliações de um prestador |
| `lista-espera` | Gerencia entrada e notificação da lista de espera |
| `reagendar-cliente` | Reagendamento com atualização no Google Calendar |
| `cancelar-agendamento-cliente` | Cancelamento com atualização no Google Calendar |

---

## 7. Regras de Negócio Críticas

### Timezone (não alterar)
```javascript
// SEMPRE construir com offset explícito:
const dataHoraBRT = `${_dy}-${_dm}-${_dd}T${pad(hh)}:${pad(mm)}:00-03:00`;
const dataHoraISO = new Date(dataHoraBRT).toISOString();

// Ranges de dia:
const inicioDia = new Date(`${_sds}T00:00:00-03:00`);
const fimDia    = new Date(`${_sds}T23:59:59-03:00`);
```

### Limite Free
- 30 agendamentos por mês (não cancelados)
- Verificação no frontend (UX) e no backend (proteção real via `criar-agendamento`)
- Ao atingir, exibe banner com botão WhatsApp do prestador

### Grace Period Pro
- 3 dias após `plano_valido_ate` antes de regredir para Free
- Evita perda de acesso imediata por atraso de pagamento

### Detecção de conflito de slot
- Edge Function `criar-agendamento` usa `.gt("fim")` (não `.gte`) para não conflitar com horários no limite exato

---

## 8. Deploys

```bash
# Frontend
firebase deploy --only hosting

# Edge Function específica
supabase functions deploy [nome-da-function]
```

---

## 9. Pendências e Roadmap

### Alta prioridade

**Sistema de Avaliações**
- Infra necessária: tabela `avaliacoes` (prestador_id, agendamento_id, cliente_nome, nota, comentario, created_at)
- Coleta pós-atendimento: mensagem automática via WhatsApp/Evolution API quando status do agendamento muda para 'concluido'
- Link único por agendamento para evitar avaliações duplicadas
- Moderação simples: avaliação entra como pendente, aprovada automaticamente após X horas sem ação do prestador
- Exibição: já implementada na página Pro (aguarda dados reais)

### Média prioridade

**Trial nurturing email flow**
- Infraestrutura pronta: `trial_ends_at` no banco, SendGrid configurado, padrão de cron estabelecido
- Emails em D+1, D+3 e D+5 do trial com dicas de uso e argumento de upgrade

**Upload de fotos (galeria)**
- Hoje: URLs externas (Google Fotos etc.)
- Futuro: upload direto para Supabase Storage ou Firebase Storage
- Gatilho: quando o volume de profissionais Pro justificar o custo de armazenamento

**Lightbox na galeria**
- Implementação: JS puro, sem dependências
- Click em foto → modal fullscreen → navegação anterior/próxima → fechar com ESC

### Baixa prioridade / Futura

**Landing page `agendapro.com.br`**
- Hoje: rodapé da página pública aponta para `https://e-agendapro.web.app`
- Futuro: landing page de marketing separada

**Página Pro — features adicionais**
- Carousel de fotos como alternativa ao grid (para espaços/studios)
- Verificação de identidade (badge verificado no avatar)
- Link direto para WhatsApp do profissional no hero Pro

---

## 10. Aquisição Orgânica

Toda página de profissional Pro exibe no rodapé:
> "Agendamento por AgendaPro"

O cliente que agenda com um Pro vê uma página premium (avaliações, cor de marca, galeria). Se esse cliente também for autônomo, clica e vira lead. Custo de aquisição: zero.

**Por isso a diferença visual entre Free e Pro é estratégica** — ela é o anúncio.
