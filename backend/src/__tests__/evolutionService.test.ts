import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { EvolutionService } from '../services/evolutionService';

vi.mock('axios');

describe('EvolutionService', () => {
  const baseUrl = 'http://localhost:8080';
  const globalToken = 'global-token';
  let evolutionService: EvolutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    evolutionService = new EvolutionService(baseUrl, globalToken);
  });

  it('should create an instance', async () => {
    const instanceName = 'test-instance';
    const mockResponse = { data: { instance: { instanceName: 'test-instance' } } };
    (axios.post as any).mockResolvedValue(mockResponse);

    const result = await evolutionService.createInstance(instanceName);

    expect(axios.post).toHaveBeenCalledWith(
      `${baseUrl}/instance/create`,
      expect.objectContaining({
        instanceName,
        qrcode: true,
      }),
      { headers: { apikey: globalToken } }
    );
    expect(result).toEqual(mockResponse.data);
  });

  it('should get QR code', async () => {
    const instanceName = 'test-instance';
    const mockResponse = { data: { base64: 'qr-code-data' } };
    (axios.get as any).mockResolvedValue(mockResponse);

    const result = await evolutionService.getQrCode(instanceName);

    expect(axios.get).toHaveBeenCalledWith(`${baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: globalToken }
    });
    expect(result).toEqual(mockResponse.data);
  });

  it('should get status', async () => {
    const instanceName = 'test-instance';
    const mockResponse = { data: { instance: { state: 'open' } } };
    (axios.get as any).mockResolvedValue(mockResponse);

    const result = await evolutionService.getStatus(instanceName);

    expect(axios.get).toHaveBeenCalledWith(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: globalToken }
    });
    expect(result).toEqual(mockResponse.data);
  });

  it('should set webhook', async () => {
    const instanceName = 'test-instance';
    const webhookUrl = 'http://webhook.com';
    (axios.post as any).mockResolvedValue({ data: { success: true } });

    await evolutionService.setWebhook(instanceName, webhookUrl);

    expect(axios.post).toHaveBeenCalledWith(
      `${baseUrl}/webhook/set/${instanceName}`,
      {
        enabled: true,
        url: webhookUrl,
        events: ['MESSAGES_UPSERT']
      },
      { headers: { apikey: globalToken } }
    );
  });
});
