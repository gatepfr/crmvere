# WhatsApp Webhook & Message Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a webhook route to receive messages from Evolution API and normalize them into a standard format for the VereadorCRM AI engine.

**Architecture:** A normalization service will handle the extraction of data from the provider-specific payload (Evolution API), and a dedicated route will expose the webhook endpoint.

**Tech Stack:** Node.js, Express, TypeScript, Jest (for testing).

---

### Task 1: WhatsApp Normalization Service

**Files:**
- Create: `backend/src/services/whatsappService.ts`
- Create: `backend/src/__tests__/whatsappService.test.ts`

- [ ] **Step 1: Write the failing test for normalization**

```typescript
import { normalizeEvolution } from '../services/whatsappService';

describe('whatsappService', () => {
  it('should normalize Evolution API payload correctly', () => {
    const payload = {
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'ABC123'
        },
        pushName: 'John Doe',
        message: {
          conversation: 'Hello world'
        },
        messageType: 'conversation'
      }
    };
    const tenantId = 'tenant-123';

    const result = normalizeEvolution(payload, tenantId);

    expect(result).toEqual({
      from: '5511999999999',
      name: 'John Doe',
      text: 'Hello world',
      tenantId: 'tenant-123'
    });
  });

  it('should handle extendedTextMessage correctly', () => {
    const payload = {
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net'
        },
        pushName: 'John Doe',
        message: {
          extendedTextMessage: {
            text: 'Hello from extended text'
          }
        }
      }
    };
    const tenantId = 'tenant-123';

    const result = normalizeEvolution(payload, tenantId);

    expect(result.text).toBe('Hello from extended text');
  });

  it('should return empty string if no message text is found', () => {
     const payload = {
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net'
        },
        pushName: 'John Doe',
        message: {}
      }
    };
    const result = normalizeEvolution(payload, 'tenant-123');
    expect(result.text).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/src/__tests__/whatsappService.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement WhatsApp Normalization Service**

```typescript
export interface IncomingMessage {
  from: string;
  name: string;
  text: string;
  tenantId: string;
}

export const normalizeEvolution = (payload: any, tenantId: string): IncomingMessage => {
  const from = payload.data?.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
  const name = payload.data?.pushName || '';
  const text = payload.data?.message?.conversation || 
               payload.data?.message?.extendedTextMessage?.text || 
               '';

  return {
    from,
    name,
    text,
    tenantId,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test backend/src/__tests__/whatsappService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/whatsappService.ts backend/src/__tests__/whatsappService.test.ts
git commit -m "feat: implement whatsapp normalization service"
```

---

### Task 2: Webhook Route

**Files:**
- Create: `backend/src/routes/webhookRoutes.ts`
- Create: `backend/src/__tests__/webhookRoutes.test.ts`

- [ ] **Step 1: Write the failing integration test for webhook route**

```typescript
import request from 'supertest';
import app from '../app';

describe('POST /api/webhook/evolution/:tenantId', () => {
  it('should receive and process Evolution API webhook', async () => {
    const payload = {
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net'
        },
        pushName: 'John Doe',
        message: {
          conversation: 'Test message'
        }
      }
    };

    const response = await request(app)
      .post('/api/webhook/evolution/tenant-123')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'received' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/src/__tests__/webhookRoutes.test.ts`
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Implement Webhook Route**

```typescript
import { Router } from 'express';
import { normalizeEvolution } from '../services/whatsappService';

const router = Router();

router.post('/evolution/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  const payload = req.body;

  const normalized = normalizeEvolution(payload, tenantId);
  
  // For now, we just log the normalized message
  console.log('Normalized message:', normalized);

  res.status(200).json({ status: 'received' });
});

export default router;
```

- [ ] **Step 4: Run test to verify it fails again (not registered yet)**

Run: `npm test backend/src/__tests__/webhookRoutes.test.ts`
Expected: FAIL (404 Not Found)

- [ ] **Step 5: Register Webhook Route in app.ts**

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test backend/src/__tests__/webhookRoutes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/webhookRoutes.ts backend/src/__tests__/webhookRoutes.test.ts backend/src/app.ts
git commit -m "feat: implement whatsapp webhook route"
```
