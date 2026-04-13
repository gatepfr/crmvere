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
  let from = payload.data?.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
  
  // Clean phone number: remove non-digits and ensure it starts with 55 if it's a mobile
  from = from.replace(/\D/g, '');
  
  // Brazilian logic: if it's a mobile number (usually 12 or 13 digits)
  // Ensure we don't save weird strings from groups or other sources
  if (from.length < 8) from = '';

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
