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
      groupsIgnore: true,
      alwaysOnline: true
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
        byEvents: false,
        ignore_groups: true,
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
    const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
    const response = await this.client.post(`/message/sendText/${instanceName}`, {
      number: jid,
      text: text,
      delay: 1200,
      linkPreview: false
    });
    return response.data;
  }
}
