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
      event: 'unknown',
      from: '5511999999999',
      name: 'John Doe',
      text: 'Hello world',
      tenantId: 'tenant-123',
      isGroup: false,
      fromMe: false
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

  it('should identify group messages correctly', () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          remoteJid: '123456789@g.us',
          fromMe: false
        },
        message: { conversation: 'Group message' }
      }
    };
    const result = normalizeEvolution(payload, 'tenant-123');
    expect(result.isGroup).toBe(true);
    expect(result.from).toBe('123456789');
  });

  it('should identify broadcasts correctly', () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          remoteJid: 'status@broadcast',
          fromMe: false
        },
        message: { conversation: 'Status update' }
      }
    };
    const result = normalizeEvolution(payload, 'tenant-123');
    expect(result.isGroup).toBe(true);
    expect(result.from).toBe(''); // \D/g removes everything from "status@broadcast"
  });

  it('should identify fromMe messages correctly', () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: true
        },
        message: { conversation: 'My own message' }
      }
    };
    const result = normalizeEvolution(payload, 'tenant-123');
    expect(result.fromMe).toBe(true);
  });

  it('should extract text from image captions', () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net'
        },
        message: {
          imageMessage: {
            caption: 'Image caption'
          }
        }
      }
    };
    const result = normalizeEvolution(payload, 'tenant-123');
    expect(result.text).toBe('Image caption');
  });

  it('should extract event type correctly', () => {
    const payload = {
      event: 'MESSAGES_UPDATE',
      data: {
        key: { remoteJid: '5511999999999@s.whatsapp.net' },
        message: { conversation: 'Update' }
      }
    };
    const result = normalizeEvolution(payload, 'tenant-123');
    expect(result.event).toBe('MESSAGES_UPDATE');
  });
});
