# Início rápido

## Requisitos

- Node.js 18 ou mais recente;
- uma conta Barzano Pay com e-mail confirmado;
- uma loja e uma conta de provider ativa;
- uma integration key do mesmo ambiente da conta do provider.

Instale o SDK:

```bash
npm install @barzano/pay
```

Mantenha a chave somente no backend:

```env
BARZANO_PAY_API_KEY=pay_test_sua_chave
```

```ts
import { BarzanoPay } from '@barzano/pay';

export const barzano = new BarzanoPay({
  apiKey: process.env.BARZANO_PAY_API_KEY!,
  environment: 'sandbox',
  timeoutMs: 10_000,
});
```

Nunca coloque a integration key em React, Vue, Angular, aplicativo móvel ou JavaScript entregue ao
navegador. Seu frontend chama seu próprio backend, e seu backend usa o SDK.

## Primeiro pagamento

```ts
const payment = await barzano.payments.create(
  {
    storeId: 'uuid-da-loja',
    externalId: 'pedido-123',
    amount: 200,
    currency: 'BRL',
    method: 'PIX',
    expiration: { value: 30, unit: 'MINUTES' },
    payer: {
      name: 'Cliente Teste',
      email: 'cliente@example.com',
      taxId: '52998224725',
    },
  },
  { idempotencyKey: 'pedido-123-v1' },
);

console.log(payment.id, payment.status, payment.pix?.copyAndPaste);
```

`amount` usa centavos: `200` representa R$ 2,00. Para PIX, prefira `expiration` com `MINUTES`,
`HOURS` ou `DAYS`; `expiresIn` em segundos continua disponível para compatibilidade.

Próximos passos: [pagamentos](PAYMENTS.md), [webhooks](WEBHOOKS.md) e
[tratamento de erros](ERRORS.md).
