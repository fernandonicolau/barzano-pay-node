import { describe, expectTypeOf, it } from 'vitest';

import type {
  AnyWebhookEvent,
  CreatePaymentInput,
  PaymentResponse,
  PaymentWebhookEvent,
} from '../src/index.js';

describe('public TypeScript contract', () => {
  it('narrows payment instructions and webhook payloads by discriminator', () => {
    expectTypeOf<CreatePaymentInput['method']>().toEqualTypeOf<'PIX' | 'BOLETO' | 'CREDIT_CARD'>();
    expectTypeOf<PaymentResponse['currency']>().toEqualTypeOf<'BRL'>();

    const handle = (event: AnyWebhookEvent): string => {
      if (event.type === 'webhook.test') return event.data.status;
      expectTypeOf(event).toEqualTypeOf<PaymentWebhookEvent>();
      return event.data.externalId;
    };

    expectTypeOf(handle).returns.toBeString();
  });
});
