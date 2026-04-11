# Design Spec: Módulo Mapa de Calor (Heatmap) de Demandas

**Data:** 2026-04-10
**Status:** Aprovado (Brainstorming)
**Objetivo:** Visualizar a densidade de demandas e eleitores por região através de um mapa de calor interativo.

## 1. Experiência do Usuário (UX)

### Funcionalidade
- O usuário acessa o menu **Mapa**.
- O sistema carrega um mapa da cidade (via OpenStreetMap/Leaflet).
- Manchas de calor (Heatmap) indicam onde há maior volume de demandas registradas.
- Filtros por **Categoria** (ex: ver apenas calor de "Saúde") e **Status**.

---

## 2. Detalhamento Técnico

### Coleta de Dados (Geocodificação)
Como as mensagens do WhatsApp vêm com o nome do bairro (capturado pelo campo `bairro` em `municipes`), precisamos transformar esse texto em coordenadas (Latitude/Longitude).
- **Abordagem:** O backend terá uma função de geocodificação simples (Cache de coordenadas por bairro para economizar APIs).

### Backend (Node.js)
- **Nova Rota (`/api/map`):**
    - `GET /stats`: Retorna uma lista de bairros com a contagem de demandas.
    - `GET /coordinates`: Retorna as coordenadas (lat/lng) dos bairros do Tenant para o Heatmap.

### Frontend (React + Leaflet)
- **Biblioteca:** `react-leaflet` e `leaflet.heat`.
- **Componente `VoterMap.tsx`:**
    - Renderiza o mapa centralizado na cidade do vereador.
    - Camada de Heatmap que recebe os pontos `[lat, lng, intensidade]`.

---

## 3. Banco de Dados (Drizzle)
Não requer novas tabelas, apenas consultas agregadas na tabela `municipes` e `demandas` cruzando pelo campo `bairro`.

---

## 4. Critérios de Sucesso
- O mapa carrega sem erros.
- As manchas de calor refletem proporcionalmente o número de demandas por bairro.
- O usuário consegue filtrar o calor por categoria de demanda.
