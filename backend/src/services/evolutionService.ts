import axios from 'axios';

export class EvolutionService {
  constructor(private baseUrl: string, private globalToken: string) {}

  async createInstance(instanceName: string) {
    const response = await axios.post(`${this.baseUrl}/instance/create`, {
      instanceName,
      token: Math.random().toString(36).substring(7), // Random instance token
      qrcode: true
    }, { headers: { apikey: this.globalToken } });
    return response.data;
  }

  async getQrCode(instanceName: string) {
    const response = await axios.get(`${this.baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: this.globalToken }
    });
    return response.data;
  }

  async getStatus(instanceName: string) {
    const response = await axios.get(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: this.globalToken }
    });
    return response.data;
  }

  async setWebhook(instanceName: string, webhookUrl: string) {
    await axios.post(`${this.baseUrl}/webhook/set/${instanceName}`, {
      enabled: true,
      url: webhookUrl,
      events: ["MESSAGES_UPSERT"]
    }, { headers: { apikey: this.globalToken } });
  }
}
