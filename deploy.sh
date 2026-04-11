#!/bin/bash

# Script de Deploy - CRM do Vereador
# Recomendado: VPS Ubuntu 22.04+

echo "🚀 Iniciando preparação do ambiente..."

# 1. Atualizar o sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependências básicas
sudo apt install curl git unzip -y

# 3. Instalar Docker se não existir
if ! [ -x "$(command -v docker)" ]; then
  echo "📦 Instalando Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
fi

# 4. Instalar Nginx e Certbot (SSL)
echo "🌐 Instalando Nginx e Certbot..."
sudo apt install nginx certbot python3-certbot-nginx -y

# 5. Criar pastas de volumes e dar permissões
mkdir -p backend/uploads
chmod -R 777 backend/uploads

# 6. Criar arquivo .env se não existir
if [ ! -f .env ]; then
  echo "📄 Criando arquivo .env a partir do .env.example..."
  cp .env.example .env
  echo "⚠️  Lembre-se de editar o arquivo .env com suas chaves reais!"
fi

echo "✅ Ambiente base configurado com sucesso!"
echo ""
echo "📝 PRÓXIMOS PASSOS NO SERVIDOR:"
echo "1. Edite o arquivo '.env' com suas chaves e senhas: nano .env"
echo "2. Edite o arquivo 'nginx.conf' com seus domínios reais: nano nginx.conf"
echo "3. Copie o arquivo configurado: sudo cp nginx.conf /etc/nginx/sites-available/crm"
echo "4. Ative o site no Nginx: sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/"
echo "5. Remova o site padrão: sudo rm /etc/nginx/sites-enabled/default"
echo "6. Teste o Nginx: sudo nginx -t"
echo "7. Reinicie o Nginx: sudo systemctl restart nginx"
echo "8. Gere o SSL: sudo certbot --nginx -d seu-dominio.app -d seu-dominio.api -d seu-dominio.wa"
echo "9. Inicie o projeto: docker compose up -d --build"
echo ""
echo "🚀 Tudo pronto para decolar!"
