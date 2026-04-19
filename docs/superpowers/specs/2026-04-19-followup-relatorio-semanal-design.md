# Design: Follow-up Automático e Relatório Semanal

**Data:** 2026-04-19  
**Status:** Aprovado

---

## Visão Geral

Duas funcionalidades automáticas via WhatsApp para o CRM Verê:

1. **Follow-up automático** — envia mensagem ao cidadão quando um atendimento com `precisaRetorno = true` fica sem atualização por X dias configuráveis.
2. **Relatório semanal** — toda segunda-feira às 08h, envia um resumo da semana para o número da equipe e para o número pessoal do vereador.

Ambas rodam como jobs agendados (`node-cron`) embutidos no processo Express existente, reutilizando o `EvolutionService` já disponível.

---

## 1. Banco de Dados

### Novos campos em `tenants`

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `whatsappVereadorNumber` | varchar(50) | null | Número pessoal do vereador para receber o relatório semanal |
| `followUpEnabled` | boolean | false | Liga/desliga o follow-up automático |
| `followUpDays` | integer | 5 | Dias sem resposta para disparar o follow-up |
| `followUpMessage` | varchar(2000) | (ver abaixo) | Template da mensagem. Suporta `{nome}` |

**Mensagem padrão do follow-up:**
```
Olá {nome}, passamos para informar que sua solicitação está sendo acompanhada pelo gabinete. Em breve teremos uma atualização para você. Obrigado pela paciência!
```

Nenhuma tabela nova. Migration Drizzle via `db:push` ou arquivo de migração.

---

## 2. Backend — Scheduler

### Arquivo: `backend/src/services/schedulerService.ts`

Inicializado uma única vez em `app.ts` após a conexão com o banco.

```
import schedulerService from './services/schedulerService';
schedulerService.init();
```

### Job 1 — Follow-up automático

- **Cron:** `0 9 * * *` (todo dia às 09h, horário de Brasília: `America/Sao_Paulo`)
- **Lógica por tenant:**
  1. Filtrar tenants com `followUpEnabled = true`, `whatsappInstanceId` não nulo e `active = true`
  2. Para cada tenant, buscar atendimentos onde:
     - `precisaRetorno = true`
     - `updatedAt < NOW() - followUpDays days`
     - Join com `municipes` para obter `name` e `phone`
  3. Para cada atendimento encontrado:
     - Substituir `{nome}` pelo nome do munícipe na mensagem template
     - Enviar via `EvolutionService.sendMessage()`
     - Atualizar `atendimentos.updatedAt = NOW()` para evitar reenvio no próximo ciclo

### Job 2 — Relatório semanal

- **Cron:** `0 8 * * 1` (toda segunda-feira às 08h, `America/Sao_Paulo`)
- **Lógica por tenant:**
  1. Filtrar tenants com `whatsappInstanceId` não nulo e `active = true`
  2. Consultar banco para a semana anterior (últimos 7 dias):
     - Total de atendimentos criados
     - Total de indicações criadas (`demandas` com `isLegislativo = true`)
     - Aniversariantes nos próximos 7 dias (`municipes.birthDate` por dia/mês)
     - Bairro mais ativo (bairro com mais atendimentos na semana)
  3. Montar mensagem formatada (ver formato abaixo)
  4. Enviar para `whatsappNotificationNumber` se preenchido
  5. Enviar para `whatsappVereadorNumber` se preenchido

**Formato do relatório:**
```
📊 *Relatório Semanal do Gabinete*
Semana de DD/MM a DD/MM

🗣️ Atendimentos na semana: X
📋 Indicações realizadas: X
🎂 Aniversariantes nos próximos 7 dias: X
📍 Bairro mais ativo: NOME DO BAIRRO

_Enviado automaticamente pelo CRM Verê_
```

Se não houver dados (semana sem atividade), o relatório ainda é enviado com zeros — o gabinete sabe que o sistema está funcionando.

---

## 3. Frontend — CabinetConfig

### Campos novos no estado local

```typescript
const DEFAULT_FOLLOWUP = "Olá {nome}, passamos para informar que sua solicitação está sendo acompanhada pelo gabinete. Em breve teremos uma atualização para você. Obrigado pela paciência!";

// Adicionar ao estado config:
whatsappVereadorNumber: '',
followUpEnabled: false,
followUpDays: 5,
followUpMessage: '',
```

### Bloco: Número do Vereador

Campo de texto simples próximo ao número de notificação da equipe (já existente em WhatsApp Setup). Label: "Número do Vereador (Relatório Semanal)".

### Bloco: Follow-up Automático

Estrutura visual igual ao bloco de mensagem de aniversário:
- Toggle liga/desliga com label "Ativar Follow-up Automático"
- Input numérico: "Dias sem resposta para disparar" (min: 1, max: 30)
- Textarea com template da mensagem — pré-preenchida com `DEFAULT_FOLLOWUP`
- Hint: variável `{nome}` disponível

### Bloco: Relatório Semanal

Apenas informativo — sem configuração adicional:
> "O relatório semanal é enviado automaticamente toda segunda-feira às 08h para o número da equipe e o número do vereador cadastrados acima."

### Rota de save

Nenhuma rota nova. Os novos campos são incluídos no `PATCH /config/me` existente (ou equivalente), junto com os campos já salvos.

---

## 4. Tratamento de Erros

- Se o WhatsApp do tenant estiver desconectado no momento do job, o envio falha silenciosamente com log de erro — não interrompe os demais tenants.
- Se `whatsappVereadorNumber` ou `whatsappNotificationNumber` estiver vazio, o envio para aquele número é simplesmente ignorado.
- O scheduler não tem retry — se o job falhar (ex: Evolution API fora), o próximo ciclo tentará normalmente.

---

## 5. Dependência Nova

- `node-cron` — biblioteca leve de agendamento cron para Node.js. Nenhuma outra dependência necessária.

---

## Fora do Escopo

- Retry automático em caso de falha de envio
- Histórico de follow-ups enviados
- Configuração de horário do relatório pelo usuário
- Múltiplos destinatários para o relatório
