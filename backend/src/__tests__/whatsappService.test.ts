import { describe, it, expect } from 'vitest';
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
