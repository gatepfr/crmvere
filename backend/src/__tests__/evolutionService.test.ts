import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { EvolutionService } from '../services/evolutionService';

vi.mock('axios', () => {
  const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => mockClient),
      ...mockClient
    }
  };
});

describe('EvolutionService', () => {
  const baseUrl = 'http://localhost:8080';
  const globalToken = 'global-token';
  let evolutionService: EvolutionService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    evolutionService = new EvolutionService(baseUrl, globalToken);
    // Get the mock client that was returned by axios.create
    mockClient = (axios.create as any).mock.results[0].value;
  });

  it('should create an instance', async () => {
    const instanceName = 'test-instance';
    const mockResponse = { data: { instance: { instanceName: 'test-instance' } } };
    mockClient.post.mockResolvedValue(mockResponse);

    const result = await evolutionService.createInstance(instanceName);

    expect(mockClient.post).toHaveBeenCalledWith(
      '/instance/create',
      expect.objectContaining({
        instanceName,
        qrcode: true,
      })
    );
    expect(result).toEqual(mockResponse.data);
  });

  it('should get QR code', async () => {
    const instanceName = 'test-instance';
    const mockResponse = { data: { base64: 'qr-code-data' } };
    mockClient.get.mockResolvedValue(mockResponse);

    const result = await evolutionService.getQrCode(instanceName);

    expect(mockClient.get).toHaveBeenCalledWith(`/instance/connect/${instanceName}`);
    expect(result).toEqual(mockResponse.data);
  });

  it('should get status', async () => {
    const instanceName = 'test-instance';
    const mockResponse = { data: { instance: { state: 'open' } } };
    mockClient.get.mockResolvedValue(mockResponse);

    const result = await evolutionService.getStatus(instanceName);

    expect(mockClient.get).toHaveBeenCalledWith(`/instance/connectionState/${instanceName}`);
    expect(result).toEqual(mockResponse.data);
  });

  it('should set webhook', async () => {
    const instanceName = 'test-instance';
    const webhookUrl = 'http://webhook.com';
    mockClient.post.mockResolvedValue({ data: { success: true } });

    await evolutionService.setWebhook(instanceName, webhookUrl);

    expect(mockClient.post).toHaveBeenCalledWith(
      `/webhook/set/${instanceName}`,
      expect.objectContaining({
        webhook: expect.objectContaining({
          enabled: true,
          url: webhookUrl
        })
      })
    );
  });
});
