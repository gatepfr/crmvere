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
  // Tenta encontrar o objeto da mensagem (v2 costuma usar data.messages[0])
  const data = payload.data || {};
  const messageEntry = data.messages?.[0] || data || {};
  
  // Tenta capturar o JID de múltiplos lugares possíveis
  const remoteJid = messageEntry.key?.remoteJid || 
                    messageEntry.remoteJid || 
                    data.key?.remoteJid || 
                    data.remoteJid || 
                    payload.jid || 
                    '';

  const fromMe = messageEntry.key?.fromMe || data.key?.fromMe || false;
  
  // Detecção de Grupo/Broadcast
  const isGroup = remoteJid.endsWith('@g.us') || 
                  remoteJid.endsWith('@broadcast') || 
                  remoteJid.endsWith('@newsletter') ||
                  remoteJid.endsWith('@temp');
  
  let from = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
  
  // Limpeza e correção de nono dígito (Brasil)
  from = from.replace(/\D/g, '');
  if (!isGroup && from.startsWith('55')) {
    const ddd = from.slice(2, 4);
    const rest = from.slice(4);
    if (rest.length === 8) {
      from = `55${ddd}9${rest}`;
    }
  }

  // Tenta capturar o Nome de múltiplos lugares
  const name = messageEntry.pushName || 
               data.pushName || 
               payload.pushName || 
               payload.instance || 
               'Cidadão';
  
  // Extração de Texto (mantendo a lógica robusta anterior)
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

  const text = extractText(messageEntry.message || data.message);

  return {
    event: payload.event || 'MESSAGES_UPSERT',
    from,
    jid: remoteJid,
    name,
    text,
    tenantId,
    isGroup,
    fromMe,
  };
};

