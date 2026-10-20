# Barzano Pay Node.js SDK

SDK oficial TypeScript para criar e acompanhar pagamentos pela Barzano Pay.

## Configuração assistida

```bash
npx @barzano/pay init
```

O assistente reutiliza `BARZANO_PAY_API_KEY` do ambiente ou do `.env`. Sem uma chave, permite criar
uma conta, confirmar o e-mail, entrar e gerar uma chave sandbox. O access token humano fica apenas
na memória; o projeto usa a integration key.

Comandos adicionais:

```bash
npx barzano doctor
npx barzano providers
```

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

## Consultar pagamentos

```ts
const paidPix = await barzano.payments.list({
  storeId: 'sua-store-id',
  status: 'PAID',
  paymentMethod: 'PIX',
  providerCode: 'PAGBANK',
});
```

Os filtros são aplicados pela API e sempre respeitam o tenant associado à integration key.

## Correlação e observabilidade

Use `onResponse` para enviar metadados seguros ao seu logger ou ferramenta de observabilidade. O SDK
não inclui API key, body ou dados do cliente nesse callback.

```ts
const barzano = new BarzanoPay({
  apiKey: process.env.BARZANO_PAY_API_KEY!,
  onResponse: ({ requestId, status, method, path, durationMs }) => {
    logger.info({ requestId, status, method, path, durationMs }, 'Barzano Pay request');
  },
});
```

Erros `BarzanoError` também expõem `requestId`, permitindo correlacionar o problema com o painel e o
suporte da Barzano Pay.

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

Veja também o [mapa de SDKs oficiais](docs/SDK-ROADMAP.md), com a ordem sugerida para Node.js,
Python, .NET, Java e PHP.
