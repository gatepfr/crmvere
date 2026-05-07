FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY .swcrc ./
RUN npm run build

FROM node:20-slim
WORKDIR /app

# Instala Python, Chromium e dependências do sistema
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    netcat-openbsd \
    libpq-dev \
    gcc \
    chromium \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copia dependências do Python e instala
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY wait-for-db.sh ./
RUN chmod +x wait-for-db.sh

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["sh", "wait-for-db.sh"]
