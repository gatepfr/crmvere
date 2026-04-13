export interface IncomingMessage {
  event: string;
  from: string;
  name: string;
  text: string;
  tenantId: string;
  isGroup: boolean;
  fromMe: boolean;
}

/**
 * Normalizes the payload from Evolution API into a standard format.
 */
export const normalizeEvolution = (payload: any, tenantId: string): IncomingMessage => {
  const event = payload.event || 'unknown';
  const remoteJid = payload.data?.key?.remoteJid || '';
  const fromMe = payload.data?.key?.fromMe || false;
  
  // Robust group/broadcast/newsletter detection
  const isGroup = remoteJid.endsWith('@g.us') || 
                  remoteJid.endsWith('@broadcast') || 
                  remoteJid.endsWith('@newsletter') ||
                  remoteJid.endsWith('@temp');
  
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
  
  // Extract text from various message types
  const message = payload.data?.message;
  const text = message?.conversation || 
               message?.extendedTextMessage?.text || 
               message?.imageMessage?.caption ||
               message?.videoMessage?.caption ||
               message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
               '';

  return {
    event,
    from,
    name,
    text,
    tenantId,
    isGroup,
    fromMe,
  };
};
