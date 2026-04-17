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
 * Normaliza o sinal da Evolution API. 
 * Foco: Identificar mensagens reais e ignorar o resto.
 */
export const normalizeEvolution = (payload: any, tenantId: string): IncomingMessage | null => {
  const data = payload.data || {};
  const messageEntry = data.messages?.[0] || data || {};
  const message = messageEntry.message;

  if (!message) return null;

  const remoteJid = messageEntry.key?.remoteJid || '';
  const fromMe = messageEntry.key?.fromMe === true;

  // Só queremos conversas individuais (ignora grupos e mensagens da própria IA)
  if (remoteJid.endsWith('@g.us') || fromMe) return null;

  // Extrai o número puro para busca no banco
  const from = remoteJid.split('@')[0].replace(/\D/g, '');

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
           '';
  };

  const text = extractText(message);
  if (!text) return null;

  return {
    event: 'MESSAGES_UPSERT',
    from,
    jid: remoteJid,
    name: messageEntry.pushName || 'Cidadão',
    text,
    tenantId,
    isGroup: false,
    fromMe: false
  };
};
