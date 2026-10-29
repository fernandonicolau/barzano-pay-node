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
        currency: 'BRL',
        method: 'PIX',
        expiresIn: 1800,
        payer: { name: 'Cliente Teste', email: 'cliente@example.com', taxId: '52998224725' },
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
    const request = fetchFn.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      method: 'PIX', expiresIn: 1800, payer: { email: 'cliente@example.com' },
    });
    expect(String(request?.body)).not.toContain('customer');
  });

  it('converts the legacy customer field to the canonical payer field', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'pay_1' }), { status: 201 }),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });
    await client.payments.create(
      {
        externalId: 'order_legacy', storeId: 'store_1', amount: 200, currency: 'BRL', method: 'PIX',
        customer: { name: 'Cliente', email: 'cliente@example.com', taxId: '52998224725' },
      },
      { idempotencyKey: 'order_legacy-v1' },
    );
    const request = fetchFn.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      payer: { name: 'Cliente', email: 'cliente@example.com' },
    });
    expect(String(request?.body)).not.toContain('customer');
  });

  it('forwards provider and exact payment account selection without provider-specific payloads', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'pay_1' }), { status: 201 }),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });
    await client.payments.create(
      {
        externalId: 'order_routed',
        storeId: 'store_1',
        amount: 200,
        currency: 'BRL',
        method: 'PIX',
        providerCode: 'MERCADO_PAGO',
        paymentAccountReference: '77c01736-9637-4236-9a7d-5c605c3770b1',
        payer: { name: 'Cliente', email: 'cliente@example.com', taxId: '52998224725' },
      },
      { idempotencyKey: 'order_routed-v1' },
    );
    const body = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      providerCode: 'MERCADO_PAGO',
      paymentAccountReference: '77c01736-9637-4236-9a7d-5c605c3770b1',
      method: 'PIX',
    });
    expect(body).not.toHaveProperty('accessToken');
    expect(body).not.toHaveProperty('credentials');
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

  it('synchronizes, cancels and refunds payments through the recommended public resource', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () =>
      new Response(JSON.stringify({ id: 'pay/1', status: 'CANCELED' }), { status: 200 }),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });

    await client.payments.sync('pay/1');
    await client.payments.cancel('pay/1');
    await client.payments.refund('pay/1');

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      'https://pay.barzano.com.br/api/v1/payments/pay%2F1/sync',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'https://pay.barzano.com.br/api/v1/payments/pay%2F1/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      'https://pay.barzano.com.br/api/v1/payments/pay%2F1/refund',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it.each([
    ['PAID_CHARGE_CANNOT_BE_CANCELED', 409],
    ['CANCEL_TIMEOUT_RECONCILIATION_REQUIRED', 504],
  ])('preserves cancellation code %s and requestId', async (code, status) => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code, message: 'Cancellation failed.', requestId: 'req_cancel' } }),
        { status },
      ),
    );
    const client = new BarzanoPay({ apiKey: 'pay_test_secret', fetch: fetchFn });

    await expect(client.payments.cancel('pay_1')).rejects.toMatchObject({
      code,
      status,
      requestId: 'req_cancel',
    });
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
