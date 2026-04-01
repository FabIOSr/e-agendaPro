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

# 6. Habilitar Docker no boot
sudo systemctl enable docker
sudo systemctl start docker

# 7. Verificar instalação
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

# 2. Criar docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  evolution-api:
    image: evolutionapi/evolution-api:latest
    container_name: evolution-api
    ports:
      - "8080:8080"
    environment:
      - SERVER_PORT=8080
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=sua_chave_super_segura_mude_isso_32chars
      - AUTHENTICATION_EXPOSE_IN_FETCHERS=true
    volumes:
      - evolution-data:/home/evolution/instance
    restart: unless-stopped

volumes:
  evolution-data:
EOF

# 3. Baixar imagem
docker pull evolutionapi/evolution-api:latest

# 4. Iniciar container
docker compose up -d

# 5. Verificar status
docker ps

# 6. Verificar logs
docker compose logs -f
```

**Saída esperada:**
```
CONTAINER ID   IMAGE                                STATUS
abc123def456   evolutionapi/evolution-api:latest   Up 2 minutes
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

### Variáveis de Necessárias:

```bash
EVOLUTION_API_URL=http://SEU_IP_PUBLICO:8080
EVOLUTION_API_KEY=sua_chave_super_segura_mude_isso_32chars
EVOLUTION_INSTANCE=agendapro-prod
```

### Adicionar no Supabase:

1. Acessar: https://supabase.com/dashboard/project/SEU_PROJECT_ID
2. Menu → **Settings** → **Secrets**
3. Adicionar as 3 variáveis acima

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

Após Evolution API funcionando:

1. **✅ Testar agendamento completo** (painel → WhatsApp)
2. **✅ Testar lembrete D-1** (cron + WhatsApp)
3. **⏭️ Adicionar Redis** (filas + cache)
4. **⏭️ Adicionar Mailpit** (testes email)

---

## 📋 Checklist

- [ ] Conta Oracle criada
- [ ] VM Ampere A1 criada (4 vCPU, 24GB)
- [ ] SSH funcionando
- [ ] Docker instalado
- [ ] Evolution API container rodando
- [ ] QR Code escaneado
- [ ] WhatsApp conectado (`state: "open"`)
- [ ] Teste manual de mensagem funcionou
- [ ] Variáveis configuradas no Supabase
- [ ] Firewall configurado (UFW)
- [ ] Teste via Edge Function funcionou

---

## 💰 Custos

| Item | Custo |
|------|-------|
| **Oracle Free Tier** | **$0/mês** (sempre!) |
| Energia adicional VPS | ~R$10-20/mês |
| **TOTAL** | **~R$10-20/mês** |

---

## ⚡ Performance Esperada

Com **4 vCPU + 24GB RAM**:

| Métrica | Capacidade |
|---------|-----------|
| Instâncias simultâneas | 50-100 |
| Mensagens/hora | ~5.000 |
| Profissionais suportados | 200-500 |

**Para benchmark:**
- 1 mensagem = ~2 segundos
- 1.000 mensagens/hora = ~20% de 1 vCPU

---

**Setup completo em 30-45 minutos!**

Próximo: **Redis para filas e cache** (quando precisar).
