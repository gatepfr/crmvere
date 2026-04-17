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
export const normalizeEvolution = (payload: any, tenantId: string): IncomingMessage | null => {
  const event = payload.event || '';
  // Só processamos mensagens novas (UPSERT ou CREATE)
  if (!event.includes('MESSAGES_UPSERT') && !event.includes('MESSAGES_CREATE')) {
    return null;
  }

  const data = payload.data || {};
  const messageEntry = data.messages?.[0] || data || {};
  
  // Detecção ultra-rigorosa de mensagens enviadas por nós mesmos
  const fromMe = messageEntry.key?.fromMe === true || 
                 data.key?.fromMe === true || 
                 payload.fromMe === true ||
                 payload.data?.fromMe === true;

  const remoteJid = messageEntry.key?.remoteJid || data.key?.remoteJid || '';
  const isGroup = remoteJid.endsWith('@g.us') || remoteJid.includes('@broadcast');
  
  let from = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');
  
  // Correção de nono dígito
  if (!isGroup && from.startsWith('55') && from.length === 12) {
    from = `55${from.slice(2, 4)}9${from.slice(4)}`;
  }

  const name = messageEntry.pushName || data.pushName || 'Cidadão';
  
  const extractText = (m: any): string => {
    if (!m) return '';
    if (m.ephemeralMessage?.message) return extractText(m.ephemeralMessage.message);
    if (m.viewOnceMessage?.message) return extractText(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return extractText(m.viewOnceMessageV2.message);

    return m.conversation || 
           m.extendedTextMessage?.text || 
           m.imageMessage?.caption ||
           m.videoMessage?.caption ||
           (m.imageMessage ? '[Imagem]' : '') ||
           (m.audioMessage ? '[Áudio]' : '') ||
           (m.videoMessage ? '[Vídeo]' : '') ||
           (m.locationMessage ? '[Localização]' : '') ||
           '';
  };

  const text = extractText(messageEntry.message);

  return {
    event: 'MESSAGES_UPSERT',
    from,
    jid: remoteJid,
    name,
    text,
    tenantId,
    isGroup,
    fromMe,
  };
};

