import { describe, expect, it, vi } from 'vitest';

import { BarzanoError, BarzanoPay } from '../src/index.js';

describe('BarzanoPay', () => {
  it('creates a payment with public headers and idempotency', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'pay_1', externalId: 'order_1', status: 'WAITING_PAYMENT' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });

    await client.payments.create(
      {
        externalId: 'order_1',
        storeId: 'store_1',
        amount: 200,
        method: 'PIX',
        customer: { name: 'Cliente Teste', email: 'cliente@example.com', taxId: '52998224725' },
      },
      { idempotencyKey: 'order_1-v1' },
    );

    expect(fetchFn).toHaveBeenCalledWith(
      'https://pay.barzano.com.br/api/v1/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'pay_test_secret',
          'Idempotency-Key': 'order_1-v1',
          Accept: 'application/vnd.barzano.error.v2+json',
        }),
      }),
    );
  });

  it('exposes typed API errors and requestId', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Invalid email.', requestId: 'req_1' } }),
        { status: 400 },
      ),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });

    const promise = client.payments.retrieve('pay_1');
    await expect(promise).rejects.toBeInstanceOf(BarzanoError);
    await expect(promise).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400, requestId: 'req_1' });
  });

  it('reports safe response metadata without exposing credentials or payloads', async () => {
    const onResponse = vi.fn();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'pay_1', status: 'WAITING_PAYMENT' }), {
        status: 200,
        headers: { 'x-request-id': 'req_header' },
      }),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn, onResponse });

    await client.payments.retrieve('pay_1');

    expect(onResponse).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/v1/payments/pay_1',
      status: 200,
      durationMs: expect.any(Number),
      requestId: 'req_header',
    });
    expect(JSON.stringify(onResponse.mock.calls)).not.toContain('pay_test_secret');
  });

  it('uses the response requestId header when an error body has no correlation id', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', { status: 503, headers: { 'x-request-id': 'req_header' } }),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });

    await expect(client.payments.retrieve('pay_1')).rejects.toMatchObject({
      status: 503,
      requestId: 'req_header',
    });
  });

  it('lists payments with typed operational filters', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('[]', { status: 200 }));
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });
    await client.payments.list({ storeId: 'store_1', status: 'PAID', paymentMethod: 'PIX', providerCode: 'PAGBANK' });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://pay.barzano.com.br/api/v1/payments?storeId=store_1&status=PAID&paymentMethod=PIX&providerCode=PAGBANK',
      expect.any(Object),
    );
  });

  it('discovers providers and payment methods supported by the account', async () => {
    const catalog = [{ provider: 'PAGBANK', displayName: 'PagBank', capabilities: { supportedPaymentMethods: ['PIX'] } }];
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(catalog), { status: 200 }),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });
    await expect(client.providers.list()).resolves.toEqual(catalog);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://pay.barzano.com.br/api/v1/providers',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
