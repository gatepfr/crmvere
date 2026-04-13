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
  
  // Clean phone number: remove non-digits
  from = from.replace(/\D/g, '');
  
  // Intelligent Brazilian correction (9th digit)
  // If it's a Brazilian number (starts with 55)
  if (from.startsWith('55')) {
    const rawNumber = from.slice(2); // Get everything after 55
    // If it has 10 digits (DD + 8 numbers), it's missing the 9th digit
    if (rawNumber.length === 10) {
      const ddd = rawNumber.slice(0, 2);
      const phone = rawNumber.slice(2);
      from = `55${ddd}9${phone}`; // Insert the 9
    }
  }

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
