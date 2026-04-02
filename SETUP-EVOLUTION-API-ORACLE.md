# Setup Evolution API - Oracle Free Tier

**Data:** 2026-04-01  
**Objetivo:** Instalar Evolution API no Oracle Free Tier para WhatsApp do AgendaPro  
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
8. [Ativar SSL/HTTPS](#8-ativar-sslhttps)

---

## 1. Criar Conta Oracle Cloud

1. Acessar: https://www.oracle.com/cloud/free/
2. Clicar em "Start for free"
3. Preencher: Email, Senha, País: **Brasil**
4. Verificar email
5. Fazer login

**Importante:** Usar email real que você acessa regularmente.

---

## 2. Criar Instância Ampere A1

### Criar compartment (se primeiro uso):

1. Menu → **Identity & Security** → **Compartments**
2. Criar compartment: `agenda-pro`
3. Confirmar

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
  → Baixar chave privada (.pem)

Virtual Cloud Network:
  → Create new virtual cloud network
  → VCN e subnet são criados automaticamente
```

4. **Clicar "Create"**
5. Aguardar 2-3 minutos

### Anotar informações:

```
Public IP: 203.0.113.10 (exemplo)
Username: ubuntu
SSH Key: /caminho/chave-privada.pem
```

---

## 3. Instalar Docker

### Acessar servidor:

```bash
# Linux/Mac
ssh -i /caminho/para/chave-privada.pem ubuntu@SEU_IP_PUBLICO

# Windows PowerShell
ssh -i "C:\caminho\para\chave-privada.pem" ubuntu@SEU_IP_PUBLICO
```

### Atualizar e instalar Docker:

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y ca-certificates curl gnupg lsb-release

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker ubuntu
sudo systemctl enable docker
sudo systemctl start docker

# Verificar instalação
docker --version
docker compose version
```

---

## 4. Instalar Evolution API

```bash
# Criar diretório
mkdir -p ~/evolution-api
cd ~/evolution-api
```

### Criar .env com senhas seguras:

```bash
cat > .env << 'EOF'
# PostgreSQL
POSTGRES_USER=evolution
POSTGRES_PASSWORD=GERAR_SENHA_FORTA_AQUI_32_CHARS
POSTGRES_DB=evolution

# Redis
REDIS_PASSWORD=GERAR_SENHA_FORTA_AQUI_32_CHARS

# Evolution API
EVOLUTION_API_KEY=GERAR_SENHA_FORTA_AQUI_32_CHARS
EVOLUTION_PORT=8080
EOF
```

### Gerar senhas fortes:

```bash
echo "=== SENHAS (copie para o .env) ==="
echo "POSTGRES_PASSWORD:"; openssl rand -base64 32
echo "REDIS_PASSWORD:"; openssl rand -base64 32
echo "EVOLUTION_API_KEY:"; openssl rand -base64 32
echo ""
echo "Exemplo de saída:"
echo "POSTGRES_PASSWORD: aB3kL9mN2pQ8rT7uV6wX0yZ1cB3aD5fG7hJ"
```

### Editar .env:

```bash
nano .env
# Substituir GERAR_SENHA_FORTA_AQUI_32_CHARS pelas senhas geradas
```

### Criar docker-compose.yml:

```bash
cat > docker-compose.yml << 'EOF'
services:
  # PostgreSQL
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

  # Redis
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
    container_name: evolution
    restart: unless-stopped
    environment:
      - SERVER_TYPE=http
      - SERVER_PORT=${EVOLUTION_PORT:-8080}
      - LOG_LEVEL=ERROR,WARN,INFO
      - LOG_COLOR=true
      - CORS_ORIGIN=*
      - CORS_METHODS=GET,POST,PUT,DELETE
      - CORS_CREDENTIALS=true
      # Database
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      - DATABASE_CONNECTION_CLIENT_NAME=evolution_api
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_MESSAGE_UPDATE=true
      - DATABASE_SAVE_DATA_CONTACTS=true
      - DATABASE_SAVE_DATA_CHATS=true
      - DATABASE_SAVE_DATA_LABELS=true
      - DATABASE_SAVE_DATA_HISTORIC=true
      # Redis
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://:${REDIS_PASSWORD}@redis:6379
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_REDIS_SAVE_INSTANCES=false
      - RABBITMQ_ENABLED=false
      - WEBSOCKET_ENABLED=false
      - WEBHOOK_GLOBAL_ENABLED=false
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#175197
      - CONFIG_SESSION_PHONE_CLIENT=AgendaPro
      - CONFIG_SESSION_PHONE_NAME=Chrome
      # Auth
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
```

### Iniciar containers:

```bash
docker compose up -d
docker ps
```

**Saída esperada:**

```
CONTAINER ID   IMAGE                        STATUS    PORTS
abc123def456   postgres:16.4-alpine         Up        5432
def456ghi789   redis:7.2-alpine             Up        6379
ghi789jkl012   evoapicloud/evolution-api   Up        0.0.0.0:8080->8080
```

---

## 5. Conectar WhatsApp

### Verificar se API está rodando:

```bash
curl -s http://localhost:8080/health
# Resposta: {"status":"UP","version":"2.3.6"}
```

### Criar instância:

```bash
# Substitua pela sua API Key do .env
export API_KEY="SUA_EVOLUTION_API_KEY_AQUI"

curl -s -X POST "http://localhost:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "instanceName": "agendapro"
  }'
```

### Gerar QR Code:

```bash
curl -s "http://localhost:8080/instance/connect/agendapro?apikey=$API_KEY"
```

A resposta contém o QR Code em base64. Para visualizar:

```bash
# Salvar como imagem
curl -s "http://localhost:8080/instance/connect/agendapro?apikey=$API_KEY" | jq -r '.qrcode' | base64 -d > qrcode.png

# Ou acessar pelo painel web
# http://SEU_IP:8080
```

### Escanear QR Code:

1. Abrir **WhatsApp** no celular
2. Menu → **Aparelhos conectados** → **Conectar aparato**
3. Escanear o QR Code

### Verificar conexão:

```bash
# Substitua API_KEY e instance name
curl -s "http://localhost:8080/instance/connectionState/agendapro?apikey=SUA_API_KEY"

# Resposta esperada: {"instance":"agendapro","state":"open"}
```

**State = "open"**: WhatsApp conectado ✅  
**State = "close"**: Precisa reconectar (QR Code)

---

## 6. Configurar AgendaPro

### Obter credenciais:

```bash
cd ~/evolution-api
cat .env
```

Anotar:
- `EVOLUTION_API_KEY`: sua chave de API
- IP público da VM

### Liberar portas no Oracle Cloud:

1. Acessar: https://console.oracle.com
2. Menu → **Networking** → **Virtual Cloud Networks**
3. Selecionar sua VCN
4. **Security Lists** → **Default Security List**
5. **Add Ingress Rules**:

| Serviço | Source CIDR | Protocol | Port |
|---------|-------------|----------|------|
| Evolution API | 0.0.0.0/0 | TCP | 8080 |
| SSH | 0.0.0.0/0 | TCP | 22 |

### Configurar no Supabase:

1. Acessar: https://supabase.com/dashboard/project/SEU_PROJECT_ID
2. Menu → **Settings** → **Environment Variables** (ou Secrets)

Adicionar:

```bash
EVOLUTION_API_URL=http://SEU_IP_PUBLICO:8080
EVOLUTION_API_KEY=<sua-chave-do-env>
EVOLUTION_INSTANCE=agendapro
```

---

## 7. Testar Integração

### Variáveis de ambiente para testes:

```bash
# No seu computador local
export EVOLUTION_URL="http://SEU_IP_PUBLICO:8080"
export EVOLUTION_API_KEY="SUA_CHAVE_DO_ENV"
export EVOLUTION_INSTANCE="agendaPro"
```

### Teste 1: Health check

```bash
curl -s "$EVOLUTION_URL"
# {"status":200,"message":"Welcome to the Evolution API...","version":"2.3.6"}
```

### Teste 2: Estado da instância

```bash
curl -s "$EVOLUTION_URL/instance/connectionState/$EVOLUTION_INSTANCE" -H "apikey: $EVOLUTION_API_KEY"

# {"instance":{"instanceName":"agendaPro","state":"open"}} ✅
# {"instance":{"instanceName":"agendaPro","state":"close"}} ⚠️ Reconectar
```

### Teste 3: Enviar mensagem de texto

```bash
# No servidor Oracle, usar Python (evita problemas de escape no curl)
python3 << 'PYTHON'
import requests

url = "http://localhost:8080/message/sendText/agendaPro"
headers = {"apikey": "SUA_API_KEY_AQUI", "Content-Type": "application/json"}
data = {"number": "5511999999999", "text": "Teste do AgendaPro!"}

r = requests.post(url, headers=headers, json=data)
print(r.status_code)
print(r.text)
PYTHON
```

### Teste 4: Enviar mensagem com botão

```bash
python3 << 'PYTHON'
import requests

url = "http://localhost:8080/message/sendButtons/agendaPro"
headers = {"apikey": "SUA_API_KEY_AQUI", "Content-Type": "application/json"}
data = {
    "number": "5511999999999",
    "title": "Confirme seu agendamento",
    "message": "Você tem um agendamento amanhã às 14h",
    "buttons": [
        {"type": "reply", "text": "✅ Confirmar"},
        {"type": "reply", "text": "❌ Cancelar"}
    ]
}

r = requests.post(url, headers=headers, json=data)
print(r.status_code)
print(r.text)
PYTHON
```

### Teste 5: Enviar imagem

```bash
python3 << 'PYTHON'
import requests

url = "http://localhost:8080/message/sendImage/agendaPro"
headers = {"apikey": "SUA_API_KEY_AQUI", "Content-Type": "application/json"}
data = {
    "number": "5511999999999",
    "image": "https://exemplo.com/imagem.jpg",
    "caption": "Legenda da imagem"
}

r = requests.post(url, headers=headers, json=data)
print(r.status_code)
print(r.text)
PYTHON
```

### Teste 6: Enviar lista (menu interativo)

```bash
curl -s -X POST "$EVOLUTION_URL/message/sendList/$EVOLUTION_INSTANCE" \
  -H "Content-Type: application/json" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d '{
    "number": "5511999999999",
    "title": "Escolha uma opção",
    "text": "O que você gostaria de fazer?",
    "buttonText": "Ver opções",
    "sections": [
      {
        "title": "Agendamentos",
        "rows": [
          {"id": "novo", "title": "Novo agendamento"},
          {"id": "historico", "title": "Ver histórico"}
        ]
      }
    ]
  }'
```

### Teste 7: Via Edge Function do Supabase

```bash
# Criar agendamento teste no banco primeiro
# No Supabase SQL Editor ou painel:
INSERT INTO agendamentos (cliente_id, servico_id, profissional_id, data_hora, status, telefone)
VALUES (
  'UUID_CLIENTE', 
  'UUID_SERVICO', 
  'UUID_PROF', 
  NOW() + INTERVAL '1 hour', 
  'confirmado',
  '5511999999999'
);

# Testar edge function
curl -s -X POST "https://SEU_PROJETO.supabase.co/functions/v1/lembretes-whatsapp" \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "confirmacao",
    "agendamento_id": "UUID_DO_AGENDAMENTO"
  }'
```

### Teste 8: Verificar logs

```bash
# No servidor Oracle
cd ~/evolution-api
docker compose logs evolution --tail 50 -f
```

---

### Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `Unauthorized` | API Key errada | Verificar `EVOLUTION_API_KEY` no .env |
| `404 Not Found` | Instância não existe | Criar instância (Teste 3) |
| `state: close` | WhatsApp desconectado | Escanear QR Code novamente |
| `Connection refused` | API não iniciou | `docker ps` e `docker compose logs` |
| `ECONNREFUSED` | Porta bloqueada | Verificar Security Lists Oracle |

---

## 8. Ativar SSL/HTTPS

### Opção 1: Domínio + Cloudflare (Recomendado)

1. Comprar domínio (ou usar subdomínio)
2. Adicionar no Cloudflare
3. Apontar DNS para IP da Oracle
4. Proxy ativo no Cloudflare
5. SSL automático (Flexible ou Full)

### Opção 2: Caddy (SSL automático com IP ou domínio)

```bash
cd ~/evolution-api
docker compose down
```

Adicionar ao docker-compose.yml:

```yaml
  caddy:
    image: caddy:2-alpine
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    networks:
      - app_network

volumes:
  caddy_data:
```

Criar Caddyfile:

```bash
cat > Caddyfile << 'EOF'
# Substitua pelo seu domínio ou IP
seu-dominio.com {
    reverse_proxy evolution:8080
    header {
        X-Forwarded-Proto "https"
    }
}
EOF
```

Liberar porta 443 no Security Lists e iniciar:

```bash
docker compose up -d
```

### Testar HTTPS:

```bash
curl -s https://seu-dominio.com/health
```

---

## 📋 Checklist

- [ ] Conta Oracle criada
- [ ] VM Ampere A1 criada (4 vCPU, 24GB)
- [ ] SSH funcionando
- [ ] Docker instalado
- [ ] .env configurado com senhas fortes
- [ ] Containers rodando (postgres, redis, evolution)
- [ ] QR Code escaneado
- [ ] WhatsApp conectado (`state: "open"`)
- [ ] Teste de mensagem funcionou
- [ ] Variáveis configuradas no Supabase
- [ ] Security Lists configuradas (portas 8080, 22)
- [ ] Teste via Edge Function funcionou
- [ ] SSL configurado (opcional para produção)

---

## 🚀 Próximos Passos

1. ✅ Testar envio de mensagem manual
2. ✅ Configurar edge function do AgendaPro
3. ✅ Criar automações (lembretes, confirmações)
4. ⏭️ Configurar backups automáticos
5. ⏭️ Monitoramento (opcional)

---

## 💰 Custos

| Item | Custo |
|------|-------|
| **Oracle Free Tier** | **$0/mês** (sempre!) |
| **TOTAL** | **$0/mês** |

---

## 🔧 Comandos úteis

```bash
# Ver status
docker ps

# Ver logs
docker compose logs -f

# Reiniciar
docker compose restart

# Atualizar
docker compose pull
docker compose up -d

# Parar
docker compose down
```