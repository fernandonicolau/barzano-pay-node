# Barzano Pay Node.js SDK

SDK oficial TypeScript para criar e acompanhar pagamentos pela Barzano Pay.

## Instalação

```bash
npm install @barzano/pay
```

## Criar um PIX

```ts
import { BarzanoPay } from '@barzano/pay';

const barzano = new BarzanoPay({
  apiKey: process.env.BARZANO_PAY_API_KEY!,
  environment: 'sandbox',
});

const payment = await barzano.payments.create(
  {
    externalId: 'pedido-123',
    storeId: 'sua-store-id',
    amount: 200,
    currency: 'BRL',
    method: 'PIX',
    customer: {
      name: 'Cliente Teste',
      email: 'cliente@example.com',
      taxId: '52998224725',
    },
  },
  { idempotencyKey: 'pedido-123-v1' },
);

console.log(payment.pix?.copyAndPaste);
```

## Validar webhook

Use o corpo bruto da requisição. Não faça `JSON.parse` antes da validação.

```ts
import { verifyWebhook } from '@barzano/pay';

const event = verifyWebhook({
  payload: rawBody,
  signature: request.headers['x-webhook-signature'],
  timestamp: request.headers['x-webhook-timestamp'],
  secret: process.env.BARZANO_WEBHOOK_SECRET!,
});
```

Consulte a [documentação da API](https://pay.barzano.com.br/docs).
