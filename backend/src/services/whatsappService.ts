export interface IncomingMessage {
  from: string;
  name: string;
  text: string;
  tenantId: string;
}

/**
 * Normalizes the payload from Evolution API into a standard format.
 * Evolution API payload structure for messages:
 * {
 *   data: {
 *     key: { remoteJid: '...' },
 *     pushName: '...',
 *     message: {
 *       conversation: '...',
 *       extendedTextMessage: { text: '...' }
 *     }
 *   }
 * }
 */
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
