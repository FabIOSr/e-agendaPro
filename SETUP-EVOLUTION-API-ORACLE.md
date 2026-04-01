# Setup Evolution API - Oracle Free Tier

**Data:** 2026-03-31
**Objetivo:** Instalar Evolution API no Oracle Free Tier para WhatsApp
**Tempo estimado:** 30-45 minutos

---

## 📋 Índice

1. [Criar Conta Oracle Cloud](#1-criar-conta-oracle-cloud)
2. [Criar Instância Ampere A1](#2-criar-instância-ampere-a1)
3. [Instalar Docker](#3-instalar-docker)
4. [Instalar Evolution API](#4-instalar-evolution-api)
5. [Conectar WhatsApp](#5-conectar-whatsapp)
6. [Configurar AgendaPro](#6-configurar-agendapro)
7. [Testar Integração](#7-testar-integração)

---

## 1. Criar Conta Oracle Cloud

### Passo a passo:

1. Acessar: https://www.oracle.com/cloud/free/
2. Clicar em "Start for free"
3. Preencher:
   - Email
   - Senha
   - País: **Brasil** (importante para região correta)
4. Verificar email
5. Fazer login

**Importante:** Usar email real que você acessa regularmente.

---

## 2. Criar Instância Ampere A1

### Criar compartment (se primeiro uso):

1. Menu → **Identity & Security**
2. Criar compartment: `agenda-pro`
3. Adicionar política de uso
4. Confirmar

### Criar VM:

1. Menu → **Compute** → **Instances**
2. Clicar **Create instance**
3. Preencher:

```
Name: evolution-api

Compartment: agenda-pro

Instance shape:
  → Series: Ampere A1
  → Shape: VM.Standard.A1.Flex
  → OCUs: 4 OCPUs (máximo free)
  → Memory: 24 GB (máximo free)

Image:
  → Operating System: Ubuntu
  → Version: 22.04 Minimal
  → (ARM64)

SSH Key:
  → Criar nova chave se não tiver
  → Baixar chave privada

Virtual Cloud Network:
  → Create new virtual cloud network
  → Criar: VCN e subnet automaticamente

Add SSH Key:
  → Colocar sua chave pública
```

4. **Clicar "Create"**
5. Aguardar 2-3 minutos (provisionamento)

### Anotar informações importantes:

```
Public IP Address: 203.0.113.1 (exemplo)
Username: ubuntu
SSH Key: /caminho/para/chave-privada.pem
```

---

## 3. Instalar Docker

### Acessar servidor via SSH:

```bash
# Linux/Mac
ssh -i /caminho/para/chave-privada.pem ubuntu@SEU_IP_PUBLICO

# Windows PowerShell
ssh -i C:\caminho\para\chave-privada.pem ubuntu@SEU_IP_PUBLICO
```

### Atualizar sistema e instalar Docker:

```bash
# 1. Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 3. Adicionar repositório Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Atualizar apt
sudo apt update

# 5. Instalar Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. Adicionar usuário ao grupo docker (evita sudo a cada comando)
sudo usermod -aG docker ubuntu

# 7. Habilitar Docker no boot
sudo systemctl enable docker
sudo systemctl start docker

# 8. Fazer logout e login novamente para aplicar grupo docker
# ou executar: newgrp docker

# 9. Verificar instalação
docker --version
docker compose version
```

**Saída esperada:**
```
Docker version 24.0.x, build af470b
Docker Compose version v2.x.x
```

---

## 4. Instalar Evolution API

### Opção A: Via Docker Compose (Recomendado)

```bash
# 1. Criar diretório
mkdir -p ~/evolution-api
cd ~/evolution-api

# 2. Criar .env com senhas seguras
cat > .env << 'EOF'
# Database (PostgreSQL)
POSTGRES_USER=evolution
POSTGRES_PASSWORD=GERAR_SENHA_FORTA_AQUI_32_CHARS
POSTGRES_DB=n8n

# Redis (Cache e filas)
REDIS_PASSWORD=GERAR_SENHA_FORTA_AQUI_32_CHARS

# Evolution API
EVOLUTION_DB_NAME=evolution
EVOLUTION_API_KEY=GERAR_SENHA_FORTA_AQUI_32_CHARS
EVOLUTION_PORT=8080
EOF

# 3. Gerar senhas fortes
echo "=== SENHAS GERADAS (copie para o .env) ==="
echo "POSTGRES_PASSWORD:"
openssl rand -base64 32
echo ""
echo "REDIS_PASSWORD:"
openssl rand -base64 32
echo ""
echo "EVOLUTION_API_KEY:"
openssl rand -base64 32

# 4. Criar docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  # PostgreSQL Database
  postgres:
    image: postgres:16.4-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Cache e filas)
  redis:
    image: redis:7.2-alpine
    container_name: redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Evolution API
  evolution:
    image: evoapicloud/evolution-api:v2.3.6
    container_name: evolution_api
    restart: unless-stopped
    environment:
      - SERVER_TYPE=http
      - SERVER_PORT=${EVOLUTION_PORT:-8080}
      - LOG_LEVEL=ERROR,WARN,INFO
      - LOG_COLOR=true
      - LOG_BAILEYS=error
      - CORS_ORIGIN=*
      - CORS_METHODS=GET,POST,PUT,DELETE
      - CORS_CREDENTIALS=true
      # Database (PostgreSQL)
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${EVOLUTION_DB_NAME:-evolution}?schema=public
      - DATABASE_CONNECTION_CLIENT_NAME=evolution_api
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_MESSAGE_UPDATE=true
      - DATABASE_SAVE_DATA_CONTACTS=true
      - DATABASE_SAVE_DATA_CHATS=true
      - DATABASE_SAVE_DATA_LABELS=true
      - DATABASE_SAVE_DATA_HISTORIC=true
      # Redis (Cache)
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://:${REDIS_PASSWORD}@redis:6379
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_REDIS_SAVE_INSTANCES=false
      - RABBITMQ_ENABLED=false
      - WEBSOCKET_ENABLED=false
      - WEBHOOK_GLOBAL_ENABLED=false
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#175197
      - CONFIG_SESSION_PHONE_CLIENT=Evolution API
      - CONFIG_SESSION_PHONE_NAME=Chrome
      # API Key
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      - TZ=America/Sao_Paulo
      - DEL_INSTANCE=false
    ports:
      - "8080:8080"
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    networks:
      - app_network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
  evolution_instances:
  evolution_store:

networks:
  app_network:
    driver: bridge
EOF

# 5. Editar .env com as senhas geradas
nano .env
# Substituir GERAR_SENHA_FORTA_AQUI_32_CHARS pelas senhas geradas acima

# 6. Iniciar containers
docker compose up -d

# 7. Verificar status
docker ps

# 8. Verificar logs
docker compose logs -f
```

**Saída esperada:**
```
CONTAINER ID   IMAGE                             STATUS
abc123def456   postgres:16.4-alpine              Up 2 minutes (healthy)
def456ghi789   redis:7.2-alpine                  Up 2 minutes (healthy)
ghi789jkl012   evoapicloud/evolution-api:v2.3.6  Up 2 minutes
```

---

## 5. Conectar WhatsApp

### Acessar painel da Evolution API:

```
URL: http://SEU_IP_PUBLICO:8080
```

### Criar instância:

1. Clicar em **"Instances"** → **"Add Instance"**
2. Preencher:

```
Instance Name: agendapro-prod
Token: [Gerar token aleatório de 32 caracteres]
Number: 5511999999999 (seu número WhatsApp com DDD)
```

3. Clicar **"Connect"**

### Conectar QR Code:

1. Evolution API vai gerar um **QR Code**
2. Abrir **WhatsApp** no celular
3. Menu → **Aparelhos conectados** → **Conectar aparelho**
4. **Escanear QR Code**
5. Aguardar conexão (3-5 segundos)

### Verificar conexão:

```bash
# Via curl
curl http://localhost:8080/instance/connectionState/agendapro-prod?apikey=sua_chave

# Resposta esperada:
{"state": "open", "instance": "agendapro-prod"}
```

**Se retornar `"state": "close"`:**
- Reconectar QR Code
- Verificar se WhatsApp está ativo no celular

---

## 6. Configurar AgendaPro

### Variáveis Necessárias:

**EVOLUTION_API_KEY** está no seu `.env`:
```bash
cat .env | grep EVOLUTION_API_KEY
```

**Adicionar no Supabase:**
1. Acessar: https://supabase.com/dashboard/project/SEU_PROJECT_ID
2. Menu → **Settings** → **Secrets**
3. Adicionar:

```bash
EVOLUTION_API_URL=http://SEU_IP_PUBLICO:8080
EVOLUTION_API_KEY=<valor do .env>
EVOLUTION_INSTANCE=agendapro-prod
```

### Configurar firewall (Recomendado):

```bash
# No servidor Oracle
sudo apt install -y ufw

# Permitir SSH
sudo ufw allow OpenSSH

# Permitir porta Evolution API
sudo ufw allow 8080/tcp

# Habilitar firewall
sudo ufw enable

# Verificar status
sudo ufw status
```

---

## 7. Testar Integração

### Teste 1: Mensagem manual

```bash
curl -X POST http://SEU_IP_PUBLICO:8080/message/sendText/agendapro-prod \
  -H "Content-Type: application/json" \
  -H "apikey: sua_chave" \
  -d '{
    "number": "5511999999999",
    "text": "🎉 Teste do AgendaPro - Evolution API no Oracle!"
  }'
```

**Resposta esperada:** `{"key": {"message": {...}}}`

### Teste 2: Via Edge Function

```bash
# No Supabase SQL Editor
SELECT * FROM agendamentos LIMIT 1;

# Copiar o ID de um agendamento teste
```

```bash
# Via terminal
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/lembretes-whatsapp \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "confirmacao",
    "agendamento_id": "UUID_DO_AGENDAMENTO"
  }'
```

### Teste 3: Criar agendamento no painel

1. Acessar `/painel`
2. Criar agendamento novo
3. Verificar mensagem no WhatsApp

---

## 🔧 Gerenciamento

### Ver logs em tempo real:

```bash
cd ~/evolution-api
docker compose logs -f
```

### Verificar status do container:

```bash
docker ps
docker stats evolution-api
```

### Reiniciar Evolution API:

```bash
cd ~/evolution-api
docker compose restart
```

### Atualizar Evolution API:

```bash
cd ~/evolution-api
docker compose pull
docker compose up -d
```

### Backup dos dados da instância:

```bash
# Criar backup
docker run --rm \
  -v evolution-data:/data \
  -v ~/backups:/backup \
  ubuntu \
  tar cvf /backup/evolution-$(date +%Y%m%d).tar /data

# Listar backups
ls -lh ~/backups/
```

---

## 🚨 Troubleshooting

### Problema: Container não inicia

```bash
# Verificar logs
docker compose logs

# Verificar se porta 8080 está livre
sudo lsof -i :8080

# Reiniciar Docker
sudo systemctl restart docker
```

### Problema: QR Code não aparece

```bash
# Verificar se container está rodando
docker ps

# Verificar logs
docker compose logs evolution-api

# Reiniciar
docker compose restart
```

### Problema: WhatsApp desconecta

```
Soluções:
1. Manter WhatsApp ativo no celular
2. Não usar mesmo número em 2 places
3. Reconectar QR Code se desconectar
4. Verificar logs: "instance state"
```

### Problema: Acesso negado (401)

```
Verificar:
1. API Key está correta no header
2. Instance name está correto
3. Nome da instância é case-sensitive
```

---

## 🔧 Adicionar n8n (Automação de Workflows)

**O que é n8n:**
- Plataforma de automação de workflows (alternativa open-source ao Zapier/Make)
- Visual workflow builder
- 400+ integrações disponíveis
- Self-hosted: seus dados ficam na sua VPS

**Casos de uso no AgendaPro:**

| Automação | Descrição |
|-----------|-----------|
| **Lembretes personalizados** | WhatsApp D-3, D-1, D-hour com mensagens customizadas |
| **Follow-up pós-agendamento** | Solicitação de avaliação 24h após atendimento |
| **Reagendamento automático** | Detectar cancelamento e oferecer reagendamento |
| **Campanhas marketing** Mensagens para clientes inativos (30+ dias) |
| **Relatórios diários** | Enviar resumo do dia para o profissional |
| **Integração Google Sheets** | Backup de agendamentos em planilha |
| **Webhook para CRM** | Sincronizar clientes com CRM externo |

### Instalação via Docker Compose (Stack Completa)

```bash
# 1. Fazer backup do .env atual
cp .env .env.backup

# 2. Adicionar variáveis n8n no .env
cat >> .env << 'EOF'

# n8n
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_ENCRYPTION_KEY=GERAR_SENHA_FORTA_AQUI_32_CHARS
N8N_TIMEZONE=America/Sao_Paulo
N8N_WEBHOOK_URL=http://SEU_IP_PUBLICO:5678/
EOF

# 3. Gerar N8N_ENCRYPTION_KEY
echo "N8N_ENCRYPTION_KEY:"
openssl rand -base64 32

# 4. Editar .env e adicionar a chave gerada
nano .env

# 5. Atualizar docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  # PostgreSQL Database
  postgres:
    image: postgres:16.4-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Cache e filas)
  redis:
    image: redis:7.2-alpine
    container_name: redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redis_data:/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Evolution API
  evolution:
    image: evoapicloud/evolution-api:v2.3.6
    container_name: evolution_api
    restart: unless-stopped
    environment:
      - SERVER_TYPE=http
      - SERVER_PORT=${EVOLUTION_PORT:-8080}
      - LOG_LEVEL=ERROR,WARN,INFO
      - LOG_COLOR=true
      - LOG_BAILEYS=error
      - CORS_ORIGIN=*
      - CORS_METHODS=GET,POST,PUT,DELETE
      - CORS_CREDENTIALS=true
      # Database (PostgreSQL)
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${EVOLUTION_DB_NAME:-evolution}?schema=public
      - DATABASE_CONNECTION_CLIENT_NAME=evolution_api
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_MESSAGE_UPDATE=true
      - DATABASE_SAVE_DATA_CONTACTS=true
      - DATABASE_SAVE_DATA_CHATS=true
      - DATABASE_SAVE_DATA_LABELS=true
      - DATABASE_SAVE_DATA_HISTORIC=true
      # Redis (Cache)
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://:${REDIS_PASSWORD}@redis:6379
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_REDIS_SAVE_INSTANCES=false
      - RABBITMQ_ENABLED=false
      - WEBSOCKET_ENABLED=false
      - WEBHOOK_GLOBAL_ENABLED=false
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#175197
      - CONFIG_SESSION_PHONE_CLIENT=Evolution API
      - CONFIG_SESSION_PHONE_NAME=Chrome
      # API Key
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      - TZ=America/Sao_Paulo
      - DEL_INSTANCE=false
    ports:
      - "8080:8080"
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    networks:
      - app_network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # n8n Main (recebe webhooks e gerencia workflows)
  n8n:
    image: n8nio/n8n:1.119.1
    container_name: n8n
    restart: unless-stopped
    environment:
      # Conexão com PostgreSQL
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=${POSTGRES_DB}
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      # Conexão com Redis (fila de execuções)
      - QUEUE_BULL_REDIS_HOST=redis
      - QUEUE_BULL_REDIS_PORT=6379
      - QUEUE_BULL_REDIS_PASSWORD=${REDIS_PASSWORD}
      - EXECUTIONS_MODE=queue
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=${N8N_PORT}
      - N8N_PROTOCOL=${N8N_PROTOCOL}
      - WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - GENERIC_TIMEZONE=${N8N_TIMEZONE}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - TZ=America/Sao_Paulo
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - app_network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # n8n Worker (processa a fila de execuções)
  n8n-worker:
    image: n8nio/n8n:1.119.1
    container_name: n8n-worker
    restart: unless-stopped
    command: worker
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=${POSTGRES_DB}
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - QUEUE_BULL_REDIS_HOST=redis
      - QUEUE_BULL_REDIS_PORT=6379
      - QUEUE_BULL_REDIS_PASSWORD=${REDIS_PASSWORD}
      - EXECUTIONS_MODE=queue
      - GENERIC_TIMEZONE=${N8N_TIMEZONE}
      - TZ=America/Sao_Paulo
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - app_network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
  n8n_data:
  evolution_instances:
  evolution_store:

networks:
  app_network:
    driver: bridge
EOF

# 6. Recrear containers
docker compose down
docker compose up -d

# 7. Verificar status (deve mostrar 5 containers)
docker ps
```

**Saída esperada:**
```
CONTAINER ID   IMAGE                             STATUS
abc123def456   postgres:16.4-alpine              Up 2 minutes (healthy)
def456ghi789   redis:7.2-alpine                  Up 2 minutes (healthy)
ghi789jkl012   evoapicloud/evolution-api:v2.3.6  Up 2 minutes
jkl012mno345   n8nio/n8n:1.119.1                Up 2 minutes
mno345pqr456   n8nio/n8n:1.119.1                Up 2 minutes (worker)
```

### Acessar n8n

```
URL: http://SEU_IP_PUBLICO:5678
```

**Primeiro acesso:** Criar conta admin
**Acessos subsequentes:** Login com email criado

### Exemplo de Workflow: Lembrete WhatsApp D-1

**No n8n:**

1. **Node 1: Cron**
   - Horário: Todos os dias às 18:00
   - Expression: `0 18 * * *`

2. **Node 2: HTTP Request (Supabase)**
   ```json
   {
     "method": "POST",
     "url": "https://SEU_PROJETO.supabase.co/rest/v1/rpc/agendamentos_amanha",
     "headers": {
       "apikey": "SUA_SERVICE_ROLE_KEY",
       "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"
     }
   }
   ```

3. **Node 3: Loop sobre agendamentos**

4. **Node 4: HTTP Request (Evolution API)**
   ```json
   {
     "method": "POST",
     "url": "http://evolution-api:8080/message/sendText/agendapro-prod",
     "headers": {
       "Content-Type": "application/json",
       "apikey": "sua_chave_super_segura"
     },
     "body": {
       "number": "={{$json.telefone}}",
       "text": "Olá {{$json.nome}}! 👋 Lembrete do seu agendamento amanhã às {{$json.horario}}. Até lá! 💈"
     }
   }
   ```

### Variáveis de Ambiente Adicionais

```bash
# Adicionar no Supabase Secrets
N8N_WEBHOOK_URL=http://SEU_IP_PUBLICO:5678/webhook
N8N_API_KEY=chave_para_webhooks_do_n8n
```

### Firewall

```bash
# Permitir porta n8n
sudo ufw allow 5678/tcp

# Verificar status
sudo ufw status
```

### Performance n8n

| Métrica | Uso típico |
|---------|------------|
| Memória (idle) | ~150-200 MB |
| Memória (workflow ativo) | ~300-500 MB |
| CPU (idle) | <1% |
| CPU (workflow ativo) | 5-15% |
| Workflows simultâneos | 20-50 |

**Com Evolution API + PostgreSQL + n8n:**
- Total RAM: ~1.2 - 2.0 GB
- PostgreSQL: ~200-300 MB
- Evolution API: ~150-200 MB
- n8n: ~150-500 MB
- Ainda sobra 22+ GB para Redis, Mailpit, etc.

### Gerenciamento

```bash
# Ver logs n8n
docker compose logs -f n8n

# Reiniciar n8n
docker compose restart n8n

# Backup workflows n8n
docker run --rm \
  -v n8n-data:/data \
  -v ~/backups:/backup \
  ubuntu \
  tar cvf /backup/n8n-workflows-$(date +%Y%m%d).tar /data

# Atualizar n8n
cd ~/evolution-api
docker compose pull n8n
docker compose up -d n8n
```

---

## 📊 Monitoramento

### Recursos da VM:

```bash
# CPU
top

# Memória
free -h

# Disco
df -h

# Docker stats
docker stats
```

### Verificar número de mensagens:

```bash
# Evolution API tem endpoint de estatísticas
curl http://localhost:8080/instance/stats/agendapro-prod?apikey=sua_chave
```

---

## 🚀 Próximos Passos

Após Stack Completa funcionando:

1. **✅ Testar agendamento completo** (painel → WhatsApp)
2. **✅ Testar lembrete D-1** (n8n + WhatsApp)
3. **✅ Criar workflows personalizados** (n8n)
4. **⏭️ Adicionar Mailpit** (testes email local)
5. **⏭️ Configurar backup automático** (pg_dump + Redis)

---

## 📋 Checklist

### Setup Básico (Evolution API)
- [ ] Conta Oracle criada
- [ ] VM Ampere A1 criada (4 vCPU, 24GB)
- [ ] SSH funcionando
- [ ] Docker instalado
- [ ] .env configurado com senhas fortes
- [ ] Stack rodando (postgres + redis + evolution)
- [ ] QR Code escaneado
- [ ] WhatsApp conectado (`state: "open"`)
- [ ] Teste manual de mensagem funcionou
- [ ] Variáveis configuradas no Supabase
- [ ] Firewall configurado (UFW)
- [ ] Teste via Edge Function funcionou

### Stack Completa (com n8n)
- [ ] n8n adicionado ao docker-compose.yml
- [ ] n8n Worker configurado
- [ ] n8n acessível via browser
- [ ] Workflow de teste criado
- [ ] Integração Evolution API + n8n funcionando
- [ ] Lembrete WhatsApp automatizado funcionando

---

## 💰 Custos

| Item | Custo |
|------|-------|
| **Oracle Free Tier** | **$0/mês** (sempre!) |
| Energia adicional VPS | ~R$10-20/mês |
| **TOTAL** | **~R$10-20/mês** |

---

## ⚡ Performance Esperada

Com **4 vCPU + 24GB RAM** e **Stack Completa** (PostgreSQL + Redis + n8n Worker):

### Apenas Evolution API + PostgreSQL + Redis

| Métrica | Capacidade |
|---------|-----------|
| Instâncias simultâneas | 200-500 |
| Mensagens/hora | ~20.000 |
| Profissionais suportados | 1000-2000 |
| Memória usada | ~600-900 MB |

### Stack Completa (Evolution + PostgreSQL + Redis + n8n + Worker)

| Métrica | Capacidade |
|---------|-----------|
| Instâncias simultâneas | 200-500 |
| Mensagens/hora | ~20.000 |
| Workflows ativos | 50-100 |
| Workers ativos | 1 (escalável) |
| Profissionais suportados | 1000-2000 |
| Memória total usada | ~1.5 - 2.5 GB |
| **RAM disponível** | **~21.5 GB** (para outros serviços) |

**Para benchmark (stack completa):**
- 1 mensagem = ~2 segundos
- 1.000 mensagens/hora = ~10% de 1 vCPU
- 1 workflow n8n = ~30-80 MB RAM (com Redis queue)
- Evolution API idle = ~150-200 MB RAM
- PostgreSQL idle = ~200-300 MB RAM
- Redis idle = ~50-100 MB RAM
- n8n main = ~150-250 MB RAM
- n8n worker = ~100-200 MB RAM

**Capacidade total estimada (stack completa):**
- 1000-2000 profissionais
- ~20.000 mensagens/hora
- 50-100 workflows simultâneos
- 1 worker (escalável para +workers se necessário)

**Vantagens da Stack Completa desde o início:**
- ✅ **PostgreSQL**: Escala indefinidamente (sem migração futura)
- ✅ **Redis**: Cache rápido + filas para workflows
- ✅ **n8n Worker**: Processamento paralelo de workflows
- ✅ **Multi-database**: n8n e Evolution API com DBs separados
- ✅ **Backup profissional**: pg_dump + Redis persistence
- ✅ **Ainda sobra 21+ GB RAM** para outros serviços
- ✅ **Produção-ready**: Health checks, restart policies, dependências

**Arquitetura:**
```
Evolution API (v2.3.6) ←→ PostgreSQL (16.4)
                           ↕
Redis (7.2) ←→ n8n Main ←→ n8n Worker
     ↓
  Queue de execuções
```

---

**Setup completo em 30-45 minutos!**

## Stack Profissional Completa

**Componentes:**
- Evolution API v2.3.6 (WhatsApp)
- PostgreSQL 16.4 (banco de dados)
- Redis 7.2 (cache + filas)
- n8n 1.119.1 + Worker (automação)

**Capacidade:**
- 1000-2000 profissionais
- ~20.000 mensagens/hora
- 50-100 workflows simultâneos
- PostgreSQL escala sem limite

**Custo:**
- Oracle Free Tier: $0/mês (sempre!)
- Energia adicional: ~R$10-20/mês

**Próximo:** Criar workflows no n8n para automação de lembretes WhatsApp
