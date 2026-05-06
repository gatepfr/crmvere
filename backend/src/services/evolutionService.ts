import axios from 'axios';

export class EvolutionService {
  private client;

  constructor(private baseUrl: string, private globalToken: string) {
    // Ensure baseUrl doesn't end with slash
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    this.client = axios.create({
      baseURL: cleanUrl,
      timeout: 30000, // 30s timeout
      headers: { 
        apikey: globalToken,
        'Content-Type': 'application/json'
      }
    });
  }

  async createInstance(instanceName: string) {
    const response = await this.client.post('/instance/create', {
      instanceName,
      token: Math.random().toString(36).substring(7),
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      settings: {
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: true,
        readStatus: true
      }
    });
    return response.data;
  }

  async getQrCode(instanceName: string) {
    const response = await this.client.get(`/instance/connect/${instanceName}`);
    return response.data;
  }

  async getStatus(instanceName: string) {
    const response = await this.client.get(`/instance/connectionState/${instanceName}`);
    return response.data;
  }

  async logoutInstance(instanceName: string) {
    const response = await this.client.delete(`/instance/logout/${instanceName}`);
    return response.data;
  }

  async deleteInstance(instanceName: string) {
    const response = await this.client.delete(`/instance/delete/${instanceName}`);
    return response.data;
  }

  async setWebhook(instanceName: string, webhookUrl: string) {
    await this.client.post(`/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: true,
        ignoreGroups: true,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "MESSAGES_DELETE",
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE"
        ]
      }
    });
  }

  async sendMessage(instanceName: string, remoteJid: string, text: string) {
    try {
      const number = remoteJid.replace(/\D/g, '');
      const payload = { number, text, delay: 1200, linkPreview: false };
      const response = await this.client.post(`/message/sendText/${instanceName}`, payload);
      return response.data;
    } catch (error: any) {
      console.error(`[WHATSAPP ERROR] Failed to send message to ${remoteJid}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async sendMediaMessage(instanceName: string, remoteJid: string, mediaUrl: string, caption: string) {
    try {
      const number = remoteJid.replace(/\D/g, '');
      const ext = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
      const videoExts = ['mp4', 'mov', 'avi', 'mkv'];
      const audioExts = ['mp3', 'ogg', 'wav', 'aac'];
      const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

      let mediatype = 'image';
      if (videoExts.includes(ext)) mediatype = 'video';
      else if (audioExts.includes(ext)) mediatype = 'audio';
      else if (docExts.includes(ext)) mediatype = 'document';

      const payload = { number, mediatype, caption, media: mediaUrl, delay: 1200 };
      const response = await this.client.post(`/message/sendMedia/${instanceName}`, payload);
      return response.data;
    } catch (error: any) {
      console.error(`[WHATSAPP ERROR] Failed to send media to ${remoteJid}:`, error.response?.data || error.message);
      throw error;
    }
  }
}
