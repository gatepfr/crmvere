#!/bin/sh
# wait-for-db.sh

echo "⏳ Aguardando banco de dados ($DB_HOST)..."

until nc -z db 5432; do
  echo "... banco ainda não está pronto. Tentando novamente em 2s."
  sleep 2
done

echo "✅ Banco de dados está online! Rodando migrações..."
npm run db:migrate:force

echo "🚀 Iniciando o servidor..."
npm run start
