export interface IncomingMessage {
  from: string;
  name: string;
  text: string;
  tenantId: string;
  isGroup: boolean;
}

/**
 * Normalizes the payload from Evolution API into a standard format.
 */
export const normalizeEvolution = (payload: any, tenantId: string): IncomingMessage => {
  const remoteJid = payload.data?.key?.remoteJid || '';
  const isGroup = remoteJid.endsWith('@g.us');
  
  let from = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
  
  // Clean phone number: remove non-digits
  from = from.replace(/\D/g, '');
  
  // Intelligent Brazilian correction (9th digit) - Only for personal chats
  if (!isGroup && from.startsWith('55')) {
    const rawNumber = from.slice(2);
    if (rawNumber.length === 10) {
      const ddd = rawNumber.slice(0, 2);
      const phone = rawNumber.slice(2);
      from = `55${ddd}9${phone}`;
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
    isGroup,
  };
};
