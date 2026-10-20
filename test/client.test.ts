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
});
