# Configuração de Secrets do GitHub

Para o CI/CD funcionar, você precisa configurar os secrets no GitHub:

## Onde configurar

1. Acesse seu repositório no GitHub
2. Vá em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**

## Secrets necessários

| Secret | Como obter |
|--------|------------|
| `SUPABASE_URL` | URL do seu projeto Supabase (ex: `https://xxx.supabase.co`) |
| `SUPABASE_ANON` | Anon key do Supabase (Settings → API) |
| `APP_URL` | URL do seu app (ex: `https://e-agendapro.web.app`) |
| `SENTRY_DSN` | DSN do Sentry (opcional) |
| `FIREBASE_PROJECT_ID` | ID do projeto no Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT` | JSON da service account (veja abaixo) |

## Como gerar o FIREBASE_SERVICE_ACCOUNT

1. Acesse Firebase Console → **Project Settings** → **Service Accounts**
2. Clique em **Generate new private key**
3. Copie todo o conteúdo do JSON baixado
4. Cole como valor da secret `FIREBASE_SERVICE_ACCOUNT`

## Resultado

Com isso configurado:
- Todo push na main → roda testes
- Se testes passarem → faz build
- Se build passar → faz deploy automático no Firebase Hosting
