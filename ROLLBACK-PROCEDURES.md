# Rollback Procedures

Procedimentos para reverter mudanças críticas no banco de dados.

---

## Backup Automático

Antes de rodar qualquer migration:
1. Acesse o SQL Editor no painel do Supabase
2. Clique em **Backup** → **Download**
3. Salve com nome: `backup_YYYYMMDD_HHMMSS.sql`

---

## Rollback por Migration

### 1. auth-migration.sql
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS prestadores;
```

### 2. migration.sql (pagamentos)
```sql
ALTER TABLE prestadores DROP COLUMN IF EXISTS asaas_customer_id;
ALTER TABLE prestadores DROP COLUMN IF EXISTS asaas_sub_id;
DROP TABLE IF EXISTS pagamentos;
```

### 3. cron-downgrade.sql
```sql
DROP FUNCTION IF EXISTS verifica_plano_ativo();
DROP JOB IF EXISTS 208;
```

### 4. cancel-token-migration.sql
```sql
ALTER TABLE agendamentos DROP COLUMN IF EXISTS cancel_token;
```

### 5. nice-migration.sql
```sql
DROP TABLE IF EXISTS avaliacoes;
DROP TABLE IF EXISTS google_calendar_tokens;
```

### 6. bloqueios_recorrentes.sql
```sql
DROP TABLE IF EXISTS bloqueios_recorrentes;
```

### 7. trial_ends_at.sql
```sql
ALTER TABLE prestadores DROP COLUMN IF EXISTS trial_ends_at;
ALTER TABLE prestadores DROP COLUMN IF EXISTS trial_usado;
```

### 8. ativar_trial_auto.sql
```sql
DROP FUNCTION IF EXISTS auto_ativar_trial();
DROP TRIGGER IF EXISTS trg_auto_ativar_trial ON auth.users;
```

### 9. downgrade_limits.sql
```sql
DROP FUNCTION IF EXISTS downgrade_pro(UUID);
DROP FUNCTION IF EXISTS aplicar_limites_free(UUID);
```

### 10. periodicidade_assinatura.sql
```sql
ALTER TABLE prestadores DROP COLUMN IF EXISTS assinatura_periodicidade;
```

### 11. lista_espera.sql
```sql
DROP TRIGGER IF EXISTS trg_marcar_lista_espera ON agendamentos;
DROP TABLE IF EXISTS lista_espera;
```

### 12. pagamentos_evento_unico (migration 29)
```sql
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_asaas_payment_evento_key;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_asaas_payment_id_key UNIQUE (asaas_payment_id);
```

### 13. criar_agendamento_atomic (migration 30)
```sql
DROP FUNCTION IF EXISTS criar_agendamento_atomic(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID);
```

### 14. fix_criar_agendamento_atomic_intervalo_slot (migration 31)
```sql
-- Re-aplicar a versao anterior da migration 30:
-- Cole o conteudo completo de migrations/30_criar_agendamento_atomic.sql
```

---

## Processo de Rollback Seguro

1. **Faça backup** do banco atual
2. **Identifique a migration** que deseja reverter
3. **Execute o SQL de reversão** correspondente acima
4. **Teste a aplicação** para garantir que nada quebrou
5. **Se algo der errado**, restaure o backup completo

---

## Contato de Emergência

Em caso de problema crítico:
- Supabase Dashboard → Support
- Backup recente pode ser restaurado via SQL Editor
