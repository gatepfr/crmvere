const { jsPDF } = require('jspdf');
const fs = require('fs');

const doc = new jsPDF();

const title = "Guia de Deploy em Producao - CRM do Vere";
const content = `
1. INFRAESTRUTURA RECOMENDADA
   - VPS com 4GB RAM (Ubuntu 22.04 LTS).
   - Dominio proprio (Ex: crmvere.com.br).

2. CONFIGURACAO DE DNS
   - Crie 3 subdominios apontando para o IP da VPS:
     * app.seu-dominio.com (Painel)
     * api.seu-dominio.com (Backend)
     * wa.seu-dominio.com (WhatsApp/Evolution)

3. PASSOS PARA DEPLOY
   a) Copie a pasta do projeto para a VPS.
   b) Execute o script 'deploy.sh' (chmod +x deploy.sh && ./deploy.sh).
   c) Configure o arquivo 'nginx.conf' com seus dominios.
   d) Ative o SSL com 'sudo certbot --nginx'.
   e) Configure o arquivo 'backend/.env' com as URLs de producao.
   f) Suba os containers: 'docker compose up -d --build'.

4. VARIAVEIS DE AMBIENTE CRITICAS (backend/.env)
   - BACKEND_URL=https://api.seu-dominio.com
   - EVOLUTION_API_URL=https://wa.seu-dominio.com
   - EVOLUTION_API_TOKEN=mestre123

5. SEGURANCA
   - Mantenha o HTTPS sempre ativo.
   - Use senhas fortes no banco de dados e no token da API.
`;

doc.setFontSize(18);
doc.text(title, 10, 20);
doc.setFontSize(12);
doc.text(content, 10, 40);

const buffer = doc.output('arraybuffer');
fs.writeFileSync('INSTRUCOES_PRODUCAO.pdf', Buffer.from(buffer));

console.log("PDF 'INSTRUCOES_PRODUCAO.pdf' gerado com sucesso!");
