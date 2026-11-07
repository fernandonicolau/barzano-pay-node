import { describe, expect, it, vi } from 'vitest';
import { encryptPagBankCard, mountMercadoPagoCard } from '../src/browser.js';
import type { EmbeddedCardError } from '../src/browser.js';

describe('browser card kit', () => {
  it('normalizes Mercado Pago Brick output without exposing raw card data', async () => {
    const onSubmit = vi.fn();
    let submit: ((data: Record<string, unknown>) => Promise<void>) | undefined;
    const unmount = vi.fn();
    const sdk = {
      bricks: () => ({
        create: vi.fn(async (_type, _container, settings) => {
          submit = settings.callbacks.onSubmit;
          return { unmount };
        }),
      }),
    };

    const controller = await mountMercadoPagoCard({
      publicKey: 'APP_USR-public',
      containerId: 'card',
      amount: 4090,
      onSubmit,
      sdk,
    });
    await submit?.({ token: 'single-use-token', payment_method_id: 'master', installments: '2' });

    expect(onSubmit).toHaveBeenCalledWith({
      providerCode: 'MERCADO_PAGO',
      creditCard: {
        checkoutMode: 'EMBEDDED',
        token: 'single-use-token',
        paymentMethodId: 'master',
        installments: 2,
      },
      display: { brand: 'master' },
    });
    await controller.unmount();
    expect(unmount).toHaveBeenCalledOnce();
  });

  it('normalizes PagBank encrypted card output', async () => {
    const result = await encryptPagBankCard({
      publicKey: 'public-key',
      holder: 'JOSE DA SILVA',
      number: '4111111111111111',
      expMonth: '12',
      expYear: '2030',
      securityCode: '123',
      installments: 3,
      sdk: { encryptCard: () => ({ hasErrors: false, encryptedCard: 'encrypted-once' }) },
    });

    expect(result).toEqual({
      providerCode: 'PAGBANK',
      creditCard: { checkoutMode: 'EMBEDDED', encrypted: 'encrypted-once', installments: 3 },
    });
    expect(JSON.stringify(result)).not.toContain('4111111111111111');
  });

  it('returns a sanitized PagBank error', async () => {
    await expect(encryptPagBankCard({
      publicKey: 'public-key',
      holder: 'INVALID',
      number: 'invalid-number',
      expMonth: '12',
      expYear: '2030',
      securityCode: '123',
      sdk: { encryptCard: () => ({ hasErrors: true, errors: [{ code: 'INVALID_NUMBER' }] }) },
    })).rejects.toEqual(expect.objectContaining<Partial<EmbeddedCardError>>({
      code: 'INVALID_NUMBER',
      message: 'O PagBank não conseguiu validar ou criptografar o cartão.',
    }));
  });
});
