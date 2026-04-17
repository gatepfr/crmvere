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

  // Extrai o número puro
  let from = remoteJid.split('@')[0].replace(/\D/g, '');

  // Normalização Brasileira: Garante 55 + DDD + 9 + Número
  if (from.startsWith('55')) {
    const ddd = from.slice(2, 4);
    const rest = from.slice(4);
    // Se tiver 8 dígitos após o DDD, adicionamos o 9
    if (rest.length === 8) {
      from = `55${ddd}9${rest}`;
    }
  } else if (from.length === 10 || from.length === 11) {
    // Se veio sem o 55 mas com DDD
    const ddd = from.slice(0, 2);
    const rest = from.slice(2);
    const finalNumber = rest.length === 8 ? `9${rest}` : rest;
    from = `55${ddd}${finalNumber}`;
  }

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
