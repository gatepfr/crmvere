# Design Spec: Integração Evolution API (WhatsApp)

**Data:** 2026-04-10
**Status:** Aprovado (Caminho Focado)
**Objetivo:** Automatizar a gestão de instâncias do WhatsApp via Evolution API, permitindo pareamento via QR Code e recebimento de mensagens via Webhook diretamente no VereadorCRM.

## 1. Arquitetura de Integração

O CRM atuará como um controlador da Evolution API para cada Gabinete (Tenant).

### Fluxo de Dados
1. **Configuração:** O Admin insere a URL do Servidor e o Token Global.
2. **Criação:** O CRM chama a Evolution API para criar uma instância nomeada com o `slug` do gabinete.
3. **Pareamento:** O CRM busca o base64 do QR Code e exibe no frontend.
4. **Webhook:** O CRM configura automaticamente o webhook da instância para apontar para `https://backend-crm.com/api/webhook/evolution/:tenantId`.

---

## 2. Detalhamento Técnico

### Frontend (React)
- **WhatsAppConfig Page:**
    - Formulário para `Evolution API URL` e `Global Token`.
    - Componente de **QR Code** com polling (atualização automática a cada 10s se não conectado).
    - Botões de ação: "Desconectar", "Reiniciar", "Atualizar Webhook".
    - Indicador de Status: `DISCONNECTED`, `CONNECTING`, `CONNECTED`.

### Backend (Node.js)
- **Rotas de WhatsApp (`/api/whatsapp`):**
    - `POST /setup`: Salva credenciais do servidor.
    - `POST /instance/create`: Cria instância na Evolution API.
    - `GET /instance/qrcode`: Retorna o QR Code atual.
    - `GET /instance/status`: Consulta o status da conexão.
- **Webhook (`/api/webhook/evolution/:tenantId`):**
    - Recebe o payload da Evolution API.
    - Filtra apenas mensagens de texto recebidas.
    - Salva na tabela `municipes` (se novo) e `demandas`.
    - Dispara o processamento via **IA Gemini**.

### Banco de Dados (Drizzle)
- Campos já adicionados na tabela `tenants`:
    - `whatsapp_instance_id`
    - `whatsapp_token` (token específico da instância gerada)

---

## 3. Segurança
- O `tenantId` no Webhook garante que as mensagens de um número de WhatsApp caiam apenas no gabinete correto.
- As chaves de API devem ser mascaradas no frontend após o primeiro salvamento.

---

## 4. Critérios de Sucesso
- Usuário consegue visualizar o QR Code no painel do CRM.
- Após escanear, o status muda para "Conectado".
- Uma mensagem enviada para o WhatsApp do gabinete aparece na lista de "Demandas" em menos de 10 segundos.
