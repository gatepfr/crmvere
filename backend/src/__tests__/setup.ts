import { vi } from 'vitest';

// Mock ioredis globally
vi.mock('ioredis', () => {
  class MockRedis {
    on = vi.fn();
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue('OK');
    del = vi.fn().mockResolvedValue(1);
    incrby = vi.fn().mockResolvedValue(1);
    expire = vi.fn().mockResolvedValue(1);
    quit = vi.fn().mockResolvedValue('OK');
    status = 'ready';
  }
  return {
    default: MockRedis,
    Redis: MockRedis,
  };
});

// Mock Stripe globally
vi.mock('stripe', () => {
  class MockStripe {
    webhooks = {
      constructEvent: vi.fn(),
    };
    checkout = {
      sessions: {
        create: vi.fn(),
      },
    };
  }
  return {
    default: MockStripe,
  };
});
