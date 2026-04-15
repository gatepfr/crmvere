import { normalizePhone } from '../utils/phoneUtils';

export interface IncomingMessage {
  event: string;
  from: string;
  jid: string;
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
  // Extract event type - fallback to upsert if message data exists
  let event = payload.event || 'unknown';
  if (event === 'unknown' && payload.data?.message) {
    event = 'MESSAGES_UPSERT';
  }
  const remoteJid = payload.data?.key?.remoteJid || '';
  const fromMe = payload.data?.key?.fromMe || false;
  
  // Robust group/broadcast/newsletter detection
  const isGroup = remoteJid.endsWith('@g.us') || 
                  remoteJid.endsWith('@broadcast') || 
                  remoteJid.endsWith('@newsletter') ||
                  remoteJid.endsWith('@temp');
  
  let from = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
  
  // Normalize phone number
  if (!isGroup) {
    from = normalizePhone(from);
  } else {
    from = from.replace(/\D/g, '');
  }

  const name = payload.data?.pushName || '';
  
  // Extract text from various message types (including nested messages like ephemeralMessage)
  const extractText = (m: any): string => {
    if (!m) return '';
    
    // Handle nested structures (ephemeral, viewOnce)
    if (m.ephemeralMessage?.message) return extractText(m.ephemeralMessage.message);
    if (m.viewOnceMessage?.message) return extractText(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return extractText(m.viewOnceMessageV2.message);
    if (m.documentWithCaptionMessage?.message) return extractText(m.documentWithCaptionMessage.message);

    return m.conversation || 
           m.extendedTextMessage?.text || 
           m.imageMessage?.caption ||
           m.videoMessage?.caption ||
           m.documentMessage?.caption ||
           '';
  };

  const text = extractText(payload.data?.message);

  return {
    event,
    from,
    jid: remoteJid,
    name,
    text,
    tenantId,
    isGroup,
    fromMe,
  };
};
