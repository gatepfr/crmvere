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
  // Evolution API v2 encapsula em data.messages[]
  const messageData = payload.data?.messages?.[0] || payload.data || {};

  // Extract event type
  let event = payload.event || 'unknown';
  if (event === 'unknown' && messageData.message) {
    event = 'MESSAGES_UPSERT';
  }

  const remoteJid = messageData.key?.remoteJid || payload.data?.key?.remoteJid || '';
  const fromMe = messageData.key?.fromMe || false;

  // Robust group/broadcast/newsletter detection
  const isGroup = remoteJid.endsWith('@g.us') || 
                  remoteJid.endsWith('@broadcast') || 
                  remoteJid.endsWith('@newsletter') ||
                  remoteJid.endsWith('@temp');

  let from = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';

  // Clean phone number: remove non-digits
  from = from.replace(/\D/g, '');

  // Intelligent Brazilian correction (9th digit)
  if (!isGroup && from.startsWith('55')) {
    const ddd = from.slice(2, 4);
    const rest = from.slice(4);
    if (rest.length === 8) {
      from = `55${ddd}9${rest}`;
    }
  }

  const name = messageData.pushName || payload.data?.pushName || '';

  // Extract text from various message types
  const extractText = (m: any): string => {
    if (!m) return '';

    if (m.ephemeralMessage?.message) return extractText(m.ephemeralMessage.message);
    if (m.viewOnceMessage?.message) return extractText(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return extractText(m.viewOnceMessageV2.message);
    if (m.documentWithCaptionMessage?.message) return extractText(m.documentWithCaptionMessage.message);

    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;

    if (m.imageMessage) return '[Imagem]';
    if (m.videoMessage) return '[Vídeo]';
    if (m.audioMessage) return '[Áudio]';
    if (m.documentMessage) return '[Arquivo]';
    if (m.stickerMessage) return '[Figurinha]';
    if (m.locationMessage) return '[Localização]';
    if (m.contactMessage || m.contactsArrayMessage) return '[Contato]';

    return '';
  };

  const text = extractText(messageData.message);

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

