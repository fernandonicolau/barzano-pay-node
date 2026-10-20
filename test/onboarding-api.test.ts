import { describe, expect, it, vi } from 'vitest';

import { OnboardingApi } from '../src/onboarding-api.js';

describe('OnboardingApi', () => {
  it('uses the human access token only to create an integration key', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ apiKey: 'pay_test_created' }), { status: 201 }),
    );
    const api = new OnboardingApi('https://pay.example', fetchFn);

    await api.createApiKey('human-jwt', 'CLI sandbox');

    expect(fetchFn).toHaveBeenCalledWith(
      'https://pay.example/api/v1/api-credentials',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer human-jwt' }),
        body: JSON.stringify({ name: 'CLI sandbox', environment: 'SANDBOX' }),
      }),
    );
  });

  it('uses the integration key for provider discovery without a human login', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('[]', { status: 200 }));
    const api = new OnboardingApi('https://pay.example', fetchFn);

    await api.providers('pay_test_existing');

    expect(fetchFn).toHaveBeenCalledWith(
      'https://pay.example/api/v1/providers',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'pay_test_existing' }),
      }),
    );
  });
});
