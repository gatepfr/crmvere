# Especificação Técnica: Transformação em App Móvel (Android/iOS) - CRM do Verê

Este documento detalha a estratégia para converter o sistema web CRM do Verê em um aplicativo móvel nativo para Android e iPhone (iOS) utilizando a tecnologia Capacitor e automação de build na nuvem.

## 1. Visão Geral
O objetivo é reaproveitar 100% da lógica e interface atual do frontend (React + Vite + Tailwind) para criar um aplicativo instalável nas lojas oficiais (Google Play e Apple App Store), sem a necessidade de um hardware Mac local para o desenvolvimento iOS.

## 2. Arquitetura do Aplicativo

### 2.1 Tecnologias Core
- **Framework Mobile:** [Capacitor v6+](https://capacitorjs.com/) - Camada de ponte (bridge) entre a Web e APIs Nativas.
- **Frontend Existente:** React 19 + Vite 8 (Pasta `frontend`).
- **Backend Existente:** Express 5 + Drizzle (Pasta `backend`).
- **Estilização:** Tailwind CSS 4 (mantendo responsividade mobile-first).

### 2.2 Fluxo de Dados e Comunicação
- **Origem dos Arquivos:** O app carregará os arquivos estáticos gerados pelo build do Vite (`frontend/dist`) localmente no dispositivo para garantir velocidade.
- **API Endpoint:** O frontend será configurado para apontar para a URL de produção (ex: `https://api.crmvere.com.br`) em vez de caminhos relativos.
- **Persistência:** Utilização de `localStorage` ou `@capacitor/preferences` para manter a sessão do usuário (JWT) ativa entre reinicializações do app.

## 3. Estratégia de Build e Publicação (CI/CD)

Como o desenvolvedor não possui um Mac, a geração dos arquivos de instalação seguirá este fluxo automatizado:

### 3.1 GitHub Actions (Automação)
- **Android Workflow:**
    - Gatilho: Push na branch `main`.
    - Ações: Instala dependências, roda `npm run build`, sincroniza com Capacitor, gera `.apk` (testes) e `.aab` (produção).
- **iOS Workflow:**
    - Gatilho: Push na branch `main`.
    - Ambiente: Máquina virtual `macos-latest` do GitHub.
    - Ações: Instala dependências, roda `npm run build`, sincroniza com Capacitor, utiliza o **Fastlane** para assinar e gerar o arquivo `.ipa` pronto para a App Store.

## 4. Identidade Visual e Recursos Nativos
- **Assets:** Geração automática de ícones e Splash Screens via `@capacitor/assets`.
- **Plugins Iniciais:**
    - `Capacitor Browser`: Para links externos.
    - `Capacitor Preferences`: Armazenamento seguro de tokens.
    - `Capacitor App`: Para controle de eventos do sistema (botão voltar no Android).

## 5. Requisitos de Lançamento (Responsabilidade do Cliente)
1. **Google Play Console:** Criação de conta de desenvolvedor (taxa única de $25).
2. **Apple Developer Program:** Assinatura anual (taxa de $99/ano).
3. **Identidade Visual:** Logo em alta resolução (1024x1024px) e fundo para Splash Screen.

## 6. Próximos Passos de Implementação
1. Instalação e configuração inicial do Capacitor no diretório `frontend`.
2. Ajuste das variáveis de ambiente para apontar para a API externa.
3. Configuração dos scripts de build e geração de assets.
4. Criação dos arquivos de configuração para GitHub Actions.
