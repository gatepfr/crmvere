# Hub Multi-IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the AI engine to support multiple providers (Gemini, OpenAI, Anthropic, Groq) and create a unified configuration interface.

**Architecture:** 
- **Database:** Rename/Update columns in `tenants` to be provider-agnostic (`ai_provider`, `ai_api_key`).
- **Backend Service:** Refactor `aiService.ts` into a Factory pattern that selects the correct client based on the tenant's configuration.
- **Frontend UI:** Redesign `AIConfig.tsx` with a provider selector and dynamic form fields.

**Tech Stack:** Node.js, OpenAI SDK, Anthropic SDK, Groq (via OpenAI-compatible SDK or Axios), Google Generative AI SDK.

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Update `tenants` table columns**

```typescript
// backend/src/db/schema.ts
export const aiProviderEnum = pgEnum("ai_provider", ["gemini", "openai", "anthropic", "groq"]);

export const tenants = pgTable("tenants", {
  // ...
  aiProvider: aiProviderEnum("ai_provider").default("gemini"),
  aiApiKey: varchar("ai_api_key", { length: 500 }), // Unified field
  aiModel: varchar("ai_model", { length: 100 }),    // Unified field
  // ...
});
```

- [ ] **Step 2: Generate and push migration**

Run: `cd backend && npx drizzle-kit push`
Expected: Database updated. Existing `geminiApiKey` and `aiModel` might need manual migration if data exists, but since we are in dev, we can start fresh.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "db: update tenants table for multi-ai provider support"
```

---

### Task 2: Backend - AI Factory Refactor

**Files:**
- Modify: `backend/src/services/aiService.ts`
- Create: `backend/package.json` (add dependencies)

- [ ] **Step 1: Install AI SDKs**

Run: `cd backend && npm install openai @anthropic-ai/sdk`

- [ ] **Step 2: Implement the Multi-AI Factory**

```typescript
// backend/src/services/aiService.ts
// Use a common interface for all providers.
// Implement handlers for:
// - Gemini (existing logic)
// - OpenAI (using openai sdk)
// - Anthropic (using @anthropic-ai/sdk)
// - Groq (using openai-compatible mode)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/aiService.ts backend/package.json
git commit -m "refactor: implement AI factory for multiple providers"
```

---

### Task 3: Backend - Configuration API Update

**Files:**
- Modify: `backend/src/routes/configRoutes.ts`
- Modify: `backend/src/routes/webhookRoutes.ts`

- [ ] **Step 1: Update routes to use new column names**

```typescript
// backend/src/routes/configRoutes.ts
// Update PATCH /update to handle aiProvider and aiApiKey
```

- [ ] **Step 2: Update Webhook to pass provider info**

```typescript
// backend/src/routes/webhookRoutes.ts
// Pass aiProvider and aiApiKey to processDemand
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/configRoutes.ts backend/src/routes/webhookRoutes.ts
git commit -m "feat: update config and webhook routes for multi-ai"
```

---

### Task 4: Frontend - Hub UI Redesign

**Files:**
- Modify: `frontend/src/pages/Dashboard/AIConfig.tsx`

- [ ] **Step 1: Implement Provider Selector**

Create a visual grid of 4 cards (Gemini, OpenAI, Anthropic, Groq). Clicking a card selects the provider and shows its specific model list and API key field.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/AIConfig.tsx
git commit -m "ui: redesign AI config page with provider selection"
```
