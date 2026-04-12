# Especificação Técnica: Sistema de Assinaturas e Controle de Acesso (Stripe)

## 1. Visão Geral
Implementar um modelo de negócio SaaS (Software as a Service) no CRM de Vereadores, permitindo a venda de assinaturas mensais via Stripe, com suporte a períodos de teste (Trial), períodos de carência (Grace Period) e gestão manual pelo SuperAdmin.

## 2. Objetivos
- Automatizar o ciclo de vida do cliente (Trial -> Assinado -> Renovado -> Bloqueado).
- Integrar com Stripe Checkout para pagamentos seguros.
- Utilizar Webhooks da Stripe para sincronização em tempo real do status de pagamento.
- Permitir que o SuperAdmin conceda acessos gratuitos ou manuais (Lifetime).
- Implementar um sistema de bloqueio amigável com período de carência.

## 3. Modelo de Dados (Alterações em `tenants`)

Novos campos na tabela `tenants`:
- `subscription_status`: `enum('trial', 'active', 'past_due', 'unpaid', 'lifetime')` - Status atual do acesso.
- `trial_ends_at`: `timestamp` - Data de expiração do teste gratuito (padrão: 7 dias após criação).
- `grace_period_ends_at`: `timestamp` - Data limite para regularização após falha no pagamento (padrão: 5 dias após falha).
- `stripe_customer_id`: `varchar(255)` - Identificador do cliente na Stripe.
- `stripe_subscription_id`: `varchar(255)` - Identificador da assinatura na Stripe.
- `is_manual`: `boolean` - Indica se o tenant foi criado manualmente pelo SuperAdmin (padrão: false).
- `monthly_price`: `integer` - Valor da assinatura em centavos (ex: 24700 para R$ 247,00) - Sobrescreve o padrão se definido.

## 4. Lógica de Controle de Acesso (Middleware)

O sistema deve verificar o status do `tenant` em cada requisição protegida:

| Status | Condição de Bloqueio | Comportamento do Sistema |
| :--- | :--- | :--- |
| `lifetime` | Nunca | Acesso Total Liberado. |
| `active` | Nunca | Acesso Total Liberado. |
| `trial` | `Data Atual > trial_ends_at` | Bloqueio Total (Redirecionar para Checkout). |
| `past_due` | `Data Atual > grace_period_ends_at` | Bloqueio Total (Redirecionar para Checkout). |
| `past_due` | `Data Atual <= grace_period_ends_at` | Acesso Liberado com Banner de Aviso (Atrasado). |
| `unpaid` | Imediato | Bloqueio Total (Redirecionar para Checkout). |

## 5. Integração com Stripe

### 5.1 Stripe Checkout
- Rota no backend para criar uma `Checkout Session`.
- O cliente é redirecionado para a Stripe para inserir o cartão.
- Sucesso: Redireciona para `/dashboard?success=true`.
- Cancelamento: Redireciona para `/billing?canceled=true`.

### 5.2 Webhooks (Sincronização)
Eventos a serem processados pelo backend:
- `checkout.session.completed`: Primeiro pagamento feito. Ativar tenant e salvar IDs da Stripe.
- `invoice.paid`: Renovação mensal bem-sucedida. Garantir status `active`.
- `invoice.payment_failed`: Falha na cobrança. Mudar para `past_due` e calcular `grace_period_ends_at` (+5 dias).
- `customer.subscription.deleted`: Assinatura cancelada ou expirada após tentativas falhas. Mudar para `unpaid`.

## 6. Funcionalidades do SuperAdmin

### 6.1 Gestão de Tenants
- **Criação Direta:** Formulário para criar tenant com status `lifetime` ou `trial` estendido.
- **Botão "Tornar Lifetime":** Altera instantaneamente o status para `lifetime`, ignorando faturas da Stripe.
- **Botão "Resetar Trial":** Define uma nova data `trial_ends_at` e volta o status para `trial`.
- **Botão "Bloquear/Desbloquear":** Força o status `unpaid` ou volta para `active` manualmente.

## 7. Configuração e Variáveis de Ambiente
- `STRIPE_SECRET_KEY`: Chave secreta da API.
- `STRIPE_WEBHOOK_SECRET`: Chave para validar envios da Stripe.
- `DEFAULT_MONTHLY_PRICE`: Valor padrão (24700).
- `TRIAL_DAYS_DEFAULT`: 7.
- `GRACE_PERIOD_DAYS_DEFAULT`: 5.

## 8. Frontend (UI/UX)
- **Banner de Trial:** Mostra dias restantes.
- **Banner de Carência:** Aviso de pagamento pendente.
- **Tela de Bloqueio:** Bloqueia a navegação e mostra o botão de assinatura.
- **Página de Billing:** Integração com o *Stripe Customer Portal* para o cliente gerenciar seu cartão e ver faturas.

## 9. Testes e Validação
- Testar fluxo de cadastro e fim do trial.
- Testar webhook de falha no pagamento (simular na Stripe CLI).
- Validar que usuários `lifetime` nunca perdem acesso.
- Validar que o SuperAdmin consegue reverter qualquer bloqueio.
