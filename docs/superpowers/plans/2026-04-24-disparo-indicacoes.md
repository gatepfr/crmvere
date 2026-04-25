# Disparo em Massa — Segmento Indicações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o segmento `indicacao` no disparo em massa para atingir todos os munícipes que possuem ao menos uma indicação legislativa.

**Architecture:** Nova branch no `resolveSegment()` do backend que faz JOIN entre `demandas` (filtrando `isLegislativo = true`) e `municipes`, retornando os destinatários únicos com respeito a optouts. No frontend, uma nova entrada no array `SEGMENT_OPTIONS` do `BroadcastModal` — sem sub-filtro de valor.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), React

---

### Task 1: Backend — Adicionar case `indicacao` em `resolveSegment()`

**Files:**
- Modify: `backend/src/services/broadcastService.ts`

- [ ] **Step 1: Abrir o arquivo e localizar o bloco `custom`**

No arquivo `backend/src/services/broadcastService.ts`, o case `custom` começa na linha 72. O novo case `indicacao` vai ser inserido logo antes dele.

- [ ] **Step 2: Adicionar o case `indicacao`**

Substituir o trecho:

```typescript
  } else if (segmentType === 'custom') {
```

Por:

```typescript
  } else if (segmentType === 'indicacao') {
    const municipeIds = await db
      .selectDistinct({ municipeId: demandas.municipeId })
      .from(demandas)
      .where(
        and(
          eq(demandas.tenantId, tenantId),
          eq(demandas.isLegislativo, true)
        )
      );

    const ids = municipeIds.map(r => r.municipeId);
    if (ids.length === 0) return [];

    rows = await db
      .select({ municipeId: municipes.id, phone: municipes.phone })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenantId), inArray(municipes.id, ids)));
  } else if (segmentType === 'custom') {
```

- [ ] **Step 3: Verificar que o arquivo compila sem erros**

```bash
cd backend && npx tsc --noEmit
```

Esperado: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/broadcastService.ts
git commit -m "feat: adicionar segmento indicacao no resolveSegment do broadcast"
```

---

### Task 2: Frontend — Adicionar opção `indicacao` no `BroadcastModal`

**Files:**
- Modify: `frontend/src/components/BroadcastModal.tsx`

- [ ] **Step 1: Atualizar o tipo `SegmentType`**

Na linha 11, substituir:

```typescript
type SegmentType = 'todos' | 'bairro' | 'lideranca' | 'aniversariantes' | 'categoria_demanda';
```

Por:

```typescript
type SegmentType = 'todos' | 'bairro' | 'lideranca' | 'aniversariantes' | 'categoria_demanda' | 'indicacao';
```

- [ ] **Step 2: Adicionar a opção no array `SEGMENT_OPTIONS`**

Na linha 19, no array `SEGMENT_OPTIONS`, adicionar a nova entrada ao final:

```typescript
const SEGMENT_OPTIONS: { value: SegmentType; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'bairro', label: 'Bairro' },
  { value: 'lideranca', label: 'Lideranças' },
  { value: 'aniversariantes', label: 'Aniversariantes do Mês' },
  { value: 'categoria_demanda', label: 'Categoria de Demanda' },
  { value: 'indicacao', label: 'Indicações Legislativas' },
];
```

- [ ] **Step 3: Confirmar que `needsSegmentValue` já exclui `indicacao` automaticamente**

A linha 135 já está correta — não precisa de alteração:

```typescript
const needsSegmentValue = segmentType === 'bairro' || segmentType === 'categoria_demanda';
```

`indicacao` não está nessa condição, então o campo de sub-filtro fica automaticamente oculto.

- [ ] **Step 4: Verificar que o frontend compila sem erros**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BroadcastModal.tsx
git commit -m "feat: adicionar opcao Indicacoes Legislativas no disparo em massa"
```
