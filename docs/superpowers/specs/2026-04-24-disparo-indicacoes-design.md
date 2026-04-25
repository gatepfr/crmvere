# Disparo em Massa — Segmento Indicações Legislativas

**Data:** 2026-04-24  
**Status:** Aprovado

## Contexto

A página de disparo em massa (`Broadcasts.tsx` / `BroadcastModal.tsx`) permite enviar mensagens WhatsApp para segmentos de munícipes. Os segmentos atuais são: `todos`, `bairro`, `lideranca`, `aniversariantes`, `categoria_demanda`, `custom`.

Indicações legislativas são demandas com `isLegislativo = true` na tabela `demandas`. Não existe hoje nenhuma forma de disparar para os munícipes que pediram indicações.

## Objetivo

Adicionar o segmento `indicacao` no disparo em massa, permitindo enviar mensagens para todos os munícipes que possuem ao menos uma indicação legislativa cadastrada.

## Design

### Backend — `broadcastService.ts`

Adicionar o case `indicacao` na função `resolveSegment()`:

- Query: `SELECT DISTINCT municipes` via JOIN com `demandas` onde `is_legislative = true` e `tenant_id = tenantId`
- Aplicar o mesmo filtro de optouts já usado pelos outros segmentos
- Nenhuma nova rota necessária — o endpoint `GET /broadcasts/segment-values` retorna array vazio para esse tipo (sem sub-valor)

### Frontend — `BroadcastModal.tsx`

- Adicionar `{ value: 'indicacao', label: 'Indicações Legislativas' }` no array de opções do dropdown de segmento
- Quando `segmentType === 'indicacao'`, ocultar o campo de valor secundário (mesmo comportamento de `todos` e `lideranca`)
- Preview e contagem de destinatários funcionam automaticamente via endpoint existente

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `backend/src/services/broadcastService.ts` | Adicionar case `indicacao` em `resolveSegment()` |
| `frontend/src/components/BroadcastModal.tsx` | Adicionar opção no dropdown, ocultar sub-filtro |

## O que não muda

- Nenhuma nova rota de API
- Nenhuma mudança no schema do banco
- Fluxo de envio, preview e cancelamento inalterados
- Optouts continuam sendo respeitados
