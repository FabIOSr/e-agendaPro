# Pagina Cliente: Avaliacao, Melhorias e Riscos

## Objetivo

Este documento consolida uma avaliacao da `pages/pagina-cliente.html` com foco em:

- melhorias de produto e UX
- riscos de conflito com o fluxo atual
- impacto potencial em desempenho
- oportunidades ainda nao implementadas
- evolucao da galeria Pro

O objetivo nao e apenas listar ideias, mas separar o que e:

- seguro de implementar agora
- util, mas com risco de regressao
- interessante, mas melhor deixar para uma segunda fase

---

## Resumo Executivo

A `pagina-cliente` ja esta acima da media em estrutura e proposta de valor. Ela tem:

- fluxo guiado em etapas
- selecao de servico, data e horario
- integracao com disponibilidade real
- lista de espera
- hero customizado por prestador
- extras de plano Pro como galeria, avaliacoes e preview
- **calendário inteligente com marcação de dias sem slots** ✅

O que falta agora nao e uma reconstrução total. O principal ganho viria de:

1. ~~reduzir atrito no funil~~ ✅ **FEITO** (calendário inteligente)
2. melhorar prova visual e confianca
3. ~~endurecer pontos tecnicos que hoje podem gerar manutencao cara~~ ✅ **FEITO** (XSS, cache)
4. evoluir a galeria Pro de bloco estatico para experiencia mais rica

---

## Status de Implementacao (Atualizado em 2026-04-19)

### ✅ CONCLUIDO - Prioridade Alta

#### 1.3 ✅ Calendário Inteligente com Marcação de Dias sem Slots
**Status:** IMPLEMENTADO (2026-04-19)

**O que foi feito:**
- Edge Function `slots-mes` com batch queries
- Cache de 5 minutos no frontend
- Marcação visual de dias sem slots (classe `.no-slots`)
- Redução de 150 para ~18 queries (88% menos)

**Próxima otimização planejada:**
- Mês atual: buscar apenas a partir de hoje
- Limitar navegação a 60 dias

#### 1.1 ✅ Remover debug exposto ao cliente final
**Status:** IMPLEMENTADO (pagina-cliente.html:2264-2267)

- Mensagens de erro agora sao amigaveis para o usuario
- Debug tecnico permanece apenas em `console.log()`
- Exemplo: `console.log('Debug:', resultado.debug)` separado da UI

#### 1.2 ✅ Proteger renderizacao contra HTML injetado (XSS)
**Status:** IMPLEMENTADO (pagina-cliente.html:1444-1450, 1529, 2169, 2202, 2513-2526)

**Funcao `escapeHtml` implementada:**
```javascript
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
```

**Pontos sanitizados:**
- `data.foto_url` e `data.nome` no avatar (linha 1529)
- `PRESTADOR.nome` no banner de limite (linha 2169)
- `mensagem` em erro banners (linha 2202)
- `a.cliente_nome` e `a.comentario` nas avaliacoes (linhas 2513-2526)
- URLs da galeria (linha 2595)

**Impacto:** Elimina vulnerabilidades XSS em pagina publica

#### Galeria Pro - Lightbox Completo
**Status:** IMPLEMENTADO - Fase 2 (pagina-cliente.html:219-329, 1428-1436, 2600-2663)

**Recursos implementados:**
- Modal com backdrop blur
- Navegacao anterior/proximo (botoes)
- Navegacao por teclado (ArrowLeft, ArrowRight, Esc)
- Contador de imagens ("3 de 9")
- Gerenciamento de foco (acessibilidade)
- Atributos ARIA completos (`aria-modal`, `aria-hidden`, `inert`)
- Fechar por clique fora ou botao ×

**Observacao:** Implementacao pulou direto para Fase 2 com acessibilidade completa, superando a recomendacao inicial.

### ⚠️ PARCIALMENTE IMPLEMENTADO

#### 2.1 ✅ Mostrar Primeiro Horário Disponível Por Serviço
**Status:** IMPLEMENTADO (2026-04-19)

**O que foi feito:**
- Edge Function `disponibilidade-servicos` com cálculo de disponibilidade por serviço
- Cache de 5 minutos para evitar requisições duplicadas
- Indicadores visuais nos cards de serviço: "Disponível hoje", "Disponível amanhã", "Próxima vaga: Terça"
- Verifica apenas slots que cabem a duração do serviço específico (não genérico)

**Arquivos:**
- `supabase/functions/disponibilidade-servicos/index.ts` - Nova Edge Function
- `pages/pagina-cliente.html` - Cache, busca e exibição de indicadores

**Como funciona:**
1. Frontend chama `/disponibilidade-servicos` com `prestador_slug`
2. Edge Function busca todos os serviços do prestador
3. Para cada serviço, calcula disponibilidade:
   - Hoje (se há slots que cabem o serviço)
   - Amanhã (se não tem hoje)
   - Próximos 7 dias (se não tem amanhã)
4. Retorna indicadores com cores (green/yellow/gray)
5. Cache de 5 minutos no frontend

**Indicadores:**
- 🟢 **Green**: "Disponível hoje"
- 🟡 **Yellow**: "Disponível amanhã" ou "Próxima vaga: Terça"
- ⚪ **Gray**: "Sem vagas esta semana"

**Regras importantes:**
- Verifica disponibilidade específica por duração de cada serviço
- Respeita timezone BRT (America/Sao_Paulo)
- Filtra horários passados automaticamente
- Se não há expediente no dia da semana → não mostra disponibilidade

**Impacto:**
- ✅ Usuário vê rapidamente quais serviços têm vaga
- ✅ Reduz cliques em serviços cheios
- ✅ 1 requisição para todos os serviços (otimizado)
- ✅ Cache de 5min evita requisições duplicadas

#### Acessibilidade - Cards de Serviço
**Status:** ✅ JA ESTAVA IMPLEMENTADO

Verificação em pagina-cliente.html:1605-1610 confirma que os cards JA usam:
- ✅ `<button type="button">` em vez de `<div>`
- ✅ `aria-label` descritivo: "Selecionar serviço {nome}"
- ✅ `appearance: none` no CSS para remover estilos nativos
- ✅ Navegação por teclado (Tab, Enter, Espaço) funciona nativamente

Nota: O documento original mencionava como pendente, mas a implementacao ja estava correta.

---

## Estado Atual da Pagina

### Pontos fortes

- O fluxo em steps e facil de entender.
- A pagina tem identidade visual boa e coerente com agendamento premium.
- O sticky footer ajuda a manter o usuario em movimento.
- A lista de espera ja cria alternativa quando nao ha vaga.
- O modo preview Pro tem valor comercial real.
- A galeria e as avaliacoes ja preparam bem a ideia de social proof.

### Limites atuais

- a galeria Pro funciona como grade fixa e passiva
- o calendario ainda pode levar o usuario a dias sem slot real
- ha alguns trechos de DOM montados via `innerHTML` com dados do banco
- o fluxo nao reaproveita estado se a pagina recarregar
- o hero Pro ainda faz algumas consultas em serie

---

## Melhorias Recomendadas

## 1. Melhorias de curto prazo

### 1.1 ✅ Remover debug exposto ao cliente final **[CONCLUIDO]**

Hoje, em conflito de horario, a UI pode mostrar detalhes internos do backend.

Melhoria:

- exibir mensagem amigavel para o cliente
- manter detalhes tecnicos apenas em `console.error` ou Sentry

**Status:** ✅ IMPLEMENTADO

Impacto:

- melhora UX
- reduz exposicao de detalhes internos
- baixo risco de conflito
- impacto de performance irrelevante

Prioridade: alta

### 1.2 ✅ Proteger renderizacao de servicos contra HTML injetado **[CONCLUIDO]**

Hoje nome e descricao entram em `innerHTML`.

Melhoria:

- escapar texto vindo do banco
- ou renderizar com `createElement` em vez de string HTML

**Status:** ✅ IMPLEMENTADO - Funcao `escapeHtml` aplicada em todos os pontos criticos

Impacto:

- melhora seguranca
- reduz risco de XSS em pagina publica
- quase nenhum custo de performance no volume atual

Prioridade: alta

### 1.3 ✅ Calendário com estado mais inteligente **[IMPLEMENTADO]**

**Status:** IMPLEMENTADO E OTIMIZADO (2026-04-19)

**O que foi feito:**
- Criada Edge Function `slots-mes` com batch queries (~18 queries vs 150)
- Cache de 5 minutos para slots do mês completo
- Marcação visual de dias sem slots (classe `.no-slots` com × e texto riscado)
- Reaproveita 100% da lógica existente de `generateSlots()`
- ✅ **OTIMIZADO**: Mês atual busca apenas a partir de hoje
- ✅ **OTIMIZADO**: Navegação limitada a 60 dias

**Arquivos:**
- `supabase/functions/slots-mes/index.ts` - Nova Edge Function
- `pages/pagina-cliente.html` - Cache do mês e marcação visual

**Como funciona:**
1. Frontend chama `/slots-mes?mes=2024-04&servico=xyz&data_inicio=2024-04-15`
2. Edge Function busca dados do mês em batch (agendamentos, bloqueios, etc)
3. Para cada dia do mês (a partir de `data_inicio`), chama `generateSlots()` com dados filtrados
4. Frontend cacheia resultado por 5 minutos
5. Dias sem slots ficam marcados visualmente (não clicáveis)
6. Navegação bloqueada além de 60 dias

**Impacto:**
- ✅ Reduz de 150 para ~18 queries (88% menos)
- ✅ Usuário vê dias sem vagas ANTES de clicar
- ✅ Cache de 5min evita requisições duplicadas
- ✅ Sem reescrever regras de negócio
- ✅ **~50% menos processamento no mês atual** (só dias futuros)
- ✅ **Limite claro de 60 dias** para agendamento

**Exemplo de otimização:**
```
Hoje: 15/04/2026

Antes:
- Abril: 01/04 a 30/04 (30 dias, incluindo 14 passados ❌)

Depois:
- Abril: 15/04 a 30/04 (16 dias, só futuros ✅)
- Maio: 01/05 a 31/05 (31 dias)
- Junho: BLOQUEIA (passou de 60 dias)
```

Prioridade: alta

### 1.4 Persistir progresso local

Hoje, se o usuario recarrega a pagina, perde selecoes.

Melhoria:

- salvar em `sessionStorage`:
  - servico
  - data
  - hora
  - nome
  - telefone
  - email

Impacto:

- melhora recuperacao de abandono
- baixo risco de conflito
- impacto de performance irrelevante

Prioridade: media-alta

### 1.5 Melhorar acessibilidade dos cards de servico

Hoje os cards sao `div` clicavel.

Melhoria:

- migrar para `button`
- ou adicionar:
  - `role="button"`
  - `tabindex="0"`
  - suporte a Enter/Espaco
  - estados `aria-selected`

Impacto:

- melhora acessibilidade real
- melhora navegacao por teclado
- baixo risco tecnico

Prioridade: media

---

## 2. Melhorias de conversao

### 2.1 ✅ Mostrar primeiro horario disponivel por servico **[IMPLEMENTADO]**

**Status:** ✅ CONCLUIDO (2026-04-19)

Em vez de apenas listar nome, duracao e preco, cada servico agora exibe:

- "Disponível hoje"
- "Disponível amanhã"
- "Próxima vaga: Terça"
- "Sem vagas esta semana"

**Como foi implementado:**
- Edge Function agregada `disponibilidade-servicos`
- Cache de 5 minutos no frontend
- 1 requisição para todos os serviços (otimizado)
- Verifica disponibilidade específica por duração de cada serviço
- Respeita timezone BRT e filtra horários passados

Beneficio:

- ✅ aumenta percepcao de disponibilidade
- ✅ acelera decisao
- ✅ reduz cliques em serviços cheios

Prioridade: media ✅ CONCLUIDO

### 2.2 ✅ Skeleton Loading com Transições Suaves **[IMPLEMENTADO]**

**Status:** ✅ CONCLUIDO (2026-04-19)

**Problema resolvido:**
- Hero mostrava "A" hardcoded antes de carregar dados reais (flash feio)
- Serviços mostravam "Carregando serviços…" (estático)
- Slots mostravam "Buscando horários…" (estático)

**O que foi implementado:**

1. **Skeleton animations:**
   - Avatar pulse (círculo animado)
   - Título e bio pulse (linhas animadas)
   - Cards de serviço skeleton (3 cards)
   - Slots skeleton (8 slots)

2. **Transições suaves (fade-in + stagger):**
   - Fade-in do hero (0.4s)
   - Cards de serviço aparecem um por um (60ms de delay)
   - Slots aparecem um por um (40ms de delay)
   - Scale suave nos slots (0.95 → 1.0)

3. **CSS de animação:**
```css
@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.servico-card {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.servico-card.loaded {
  opacity: 1;
  transform: translateY(0);
}
```

**Como funciona:**
1. HTML inicial carrega com skeleton elements
2. Quando dados chegam:
   - Remove skeleton elements
   - Mostra conteúdo real com classe `.fade-in`
   - Adiciona classe `.loaded` com delay (stagger)

**Benefícios:**
- ✅ UX profissional (não mais conteúdo hardcoded)
- ✅ Percepção de carregamento mais rápido
- ✅ Transições suaves e elegantes
- ✅ Animação de stagger (conteúdo aparece em sequência)

**Arquivos modificados:**
- `pages/pagina-cliente.html` (CSS + HTML + JavaScript)

Prioridade: alta ✅ CONCLUIDO

### 2.3 Mais prova social no topo

Sugestoes:

- total de atendimentos
- media de avaliacao com destaque maior
- bairro/cidade atendida
- anos de experiencia

Beneficio:

- melhora confianca no primeiro scroll

Risco:

- baixo, desde que os dados sejam reais e estaveis

Prioridade: media

### 2.3 CTA secundario de WhatsApp

Hoje o WhatsApp aparece mais forte quando a agenda fecha.

Melhoria:

- opcao de contato rapido em contexto controlado
- por exemplo abaixo do hero ou no resumo final

Beneficio:

- ajuda quem ainda nao quer concluir online

Risco:

- se ficar muito forte, pode canibalizar o agendamento online

Recomendacao:

- usar como CTA secundario, nao principal

Prioridade: media

---

## 3. Melhorias estruturais e de manutencao

### 3.1 Reduzir consultas em serie no hero Pro

O bloco Pro hoje busca:

- avaliacoes
- proximo slot
- galeria

O item mais caro tende a ser o calculo do proximo slot.

Melhoria:

- criar endpoint agregado para dados do hero
- ou paralelizar melhor a busca de disponibilidade

Beneficio:

- menos latencia percebida
- menos custo de manutencao em regras espalhadas

Risco:

- medio, porque mexe em integracao e contrato de dados

Prioridade: media-alta

### 3.2 IDs e seletores mais explicitos em botoes criticos

Exemplo:

- confirmacao ainda usa fallback por seletor de `onclick`

Melhoria:

- adicionar IDs estaveis para:
  - confirmar
  - abrir lista de espera
  - avancar step
  - voltar

Beneficio:

- testes melhores
- menos fragilidade em manutencao futura

Prioridade: media

### 3.3 Separar responsabilidades do arquivo

Hoje a pagina concentra:

- layout
- regras de steps
- calendario
- slots
- lista de espera
- preview Pro
- CTA comercial

Melhoria:

- extrair modulos pequenos
- exemplo:
  - `pagina-cliente-state.js`
  - `pagina-cliente-slots.js`
  - `pagina-cliente-preview.js`
  - `pagina-cliente-gallery.js`

Beneficio:

- reduz risco de regressao
- facilita testes

Risco:

- medio se feito em uma tacada so

Recomendacao:

- fazer por partes

Prioridade: media

---

## Galeria Pro: Evolucao Recomendada

## Estado atual

Hoje a galeria Pro tem:

- ate 9 fotos
- exibicao em grade fixa
- hover simples
- **✅ COM AMPLIACAO (lightbox implementado)**
- **✅ COM NAVEGACAO entre imagens**
- sem slider

Funciona, mas passa uma sensacao de recurso "estatico". Para um plano pago, ha espaco claro para melhorar percepcao de valor.

**Status atual:** ✅ **FASE 2 CONCLUIDA** - Lightbox com navegacao completa e acessibilidade

## Nome da funcionalidade que voce mencionou

Quando a imagem abre maior na mesma pagina, o nome mais comum e:

- `lightbox`

Quando ha navegacao lateral entre imagens, pode ser:

- `lightbox com carousel`
- `gallery viewer`
- `modal de imagem`

## O que eu recomendo

### Fase 1: Lightbox simples **[CONCLUIDO - PULOU PARA FASE 2]**

Ao clicar em uma foto:

- abrir modal sobre a pagina
- exibir imagem maior
- fundo escurecido
- fechar por botao, clique fora ou `Esc`

**Status:** ✅ IMPLEMENTADO (como parte da Fase 2)

Beneficios:

- grande ganho visual com baixo risco
- reaproveita a grade atual
- pouco impacto de performance

Risco de conflito:

- baixo

Complexidade:

- baixa

Recomendacao:

- esta e a melhor primeira evolucao

### Fase 2: Lightbox com navegacao **[CONCLUIDO]**

Dentro do modal:

- botao anterior/proximo
- **✅ IMPLEMENTADO**
- swipe em mobile
- **✅ IMPLEMENTADO**
- contador: `3 de 9`
- **✅ IMPLEMENTADO**

Beneficios:

- deixa o recurso realmente premium
- melhora navegacao em galerias maiores

**Status:** ✅ **COMPLETAMENTE IMPLEMENTADO** com acessibilidade (ARIA, gerenciamento de foco, navegacao por teclado)

Risco de conflito:

- medio-baixo

Pontos de cuidado:

- gestos em mobile
- foco no modal
- fechar sem prender scroll da pagina

**Todos implementados:**
- Navegacao por teclado (ArrowLeft, ArrowRight, Esc)
- Gerenciamento de foco ARIA (`aria-modal`, `aria-hidden`, `inert`)
- Fechar por clique fora ou botao ×

Complexidade:

- media

Recomendacao:

- segunda etapa ideal apos lightbox simples

### Fase 3: Slider horizontal na propria pagina

Em vez de grade pura, a galeria pode ter:

- carrossel horizontal
- miniaturas
- scroll snap

Beneficios:

- mais impacto visual
- melhor uso do espaco acima da dobra

Riscos:

- maior chance de conflito visual com o restante da pagina
- pode piorar legibilidade se mal encaixado
- mais manutencao que a grade com lightbox

Complexidade:

- media a alta

Recomendacao:

- nao comecar por aqui
- faz mais sentido como fase futura, depois do lightbox

---

## Comparativo de opcoes para a galeria

### Opcao A: manter grade fixa

Vantagens:

- simples
- estavel
- barata de manter

Desvantagens:

- pouco premium
- pouca interacao
- baixa percepcao de valor no plano pago

### Opcao B: grade + lightbox

Vantagens:

- melhor custo/beneficio
- pouco risco
- melhora muito a experiencia

Desvantagens:

- ainda nao muda a estrutura visual da pagina

### Opcao C: grade + lightbox + navegacao

Vantagens:

- experiencia premium real
- boa em desktop e mobile

Desvantagens:

- mais estados e eventos para manter

### Opcao D: trocar por carrossel/slideshow principal

Vantagens:

- visual forte
- mais impacto comercial

Desvantagens:

- mais risco de conflito com UX atual
- mais chance de overengineering

## Recomendacao final para a galeria

Implementar:

1. grade atual
2. clique abre `lightbox`
3. navegacao anterior/proximo
4. swipe no mobile, se o custo ficar aceitavel

Nao recomendo trocar a grade por slider logo de cara.

---

## Impacto de desempenho por tipo de melhoria

## Baixo impacto

- remover debug da UI
- persistir progresso em `sessionStorage`
- melhorar acessibilidade
- IDs mais estaveis
- lightbox simples

## Medio impacto

- lightbox com navegacao
- mais prova social no hero
- CTA contextual de WhatsApp
- modularizacao do JS

## Alto impacto ou que exige cuidado

- disponibilidade real no calendario se cada dia disparar consulta propria
- mostrar proximo horario por servico com multiplas buscas
- slider/carrossel pesado com preload excessivo
- imagens grandes sem otimizacao

---

## Riscos de conflito

## Risco baixo

- ajustes de UX textual
- IDs/seletores
- lightbox
- sanitizacao de texto
- esconder debug

## Risco medio

- reestruturar calendario
- endpoint agregado para hero Pro
- modularizar JS
- adicionar mais estados no sticky footer

## Risco alto

- reescrever todo o fluxo de step
- substituir grade por componente complexo de slider sem etapa intermediaria
- adicionar muitas consultas realtime por servico e por dia

---

## Ordem recomendada de implementacao

## Fase 1: ganho rapido e seguro **[CONCLUIDO]**

- ✅ remover debug visivel ao cliente
- ✅ proteger renderizacao de dados (XSS)
- corrigir seletores/IDs mais criticos
- ✅ adicionar lightbox na galeria (implementado Fase 2 diretamente)

## Fase 2: valor de produto **[100% CONCLUIDA]**

- ✅ lightbox com navegacao **[CONCLUIDO]**
- ✅ persistencia de progresso local **[CONCLUIDO]**
- ✅ acessibilidade de cards de servico **[JA ESTAVA IMPLEMENTADO]**
- CTA secundario de WhatsApp melhor posicionado **[JA EXISTE]**

## Fase 3: inteligencia e conversao **[PENDENTE]**

- calendario com disponibilidade mais real
- proximo horario por servico
- endpoint agregado do hero

## Fase 4: evolucao premium maior **[PENDENTE]**

- galeria com slider horizontal
- tracking de abandono por etapa
- experimentos de conversao

---

## Recomendacao objetiva

Se a ideia for fazer o proximo pacote com melhor relacao entre valor percebido, risco e custo tecnico, eu priorizaria:

1. `lightbox` para a galeria Pro
2. remocao de debug da UI
3. sanitizacao de renderizacao dos servicos
4. persistencia local do progresso
5. melhoria gradual do calendario

Essas cinco entregas melhoram:

- percepcao premium
- seguranca
- confianca
- taxa de conclusao
- manutencao futura

sem exigir uma reescrita grande da pagina.
