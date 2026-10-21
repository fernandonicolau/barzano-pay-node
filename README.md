# Barzano Pay Node.js SDK

SDK oficial TypeScript para criar e acompanhar pagamentos pela Barzano Pay. A plataforma oferece
um contrato único para sua aplicação integrar meios de pagamento sem acoplar o código diretamente
ao banco ou provider.

- [Conhecer a plataforma e acessar o painel](https://pay.barzano.com.br)
- [Documentação completa da API](https://pay.barzano.com.br/docs)
- [Pacote no npm](https://www.npmjs.com/package/@barzano/pay)

## Providers e meios disponíveis

O catálogo é dinâmico: consulte a API para saber quais providers, ambientes e meios estão realmente
habilitados para sua conta. Não mantenha uma lista fixa na aplicação.

```ts
const providers = await barzano.providers.list();

for (const provider of providers) {
  console.log(provider.displayName);
  console.log(provider.capabilities.supportedPaymentMethods);
}
```

Hoje o primeiro adapter é o **PagBank**. As capabilities retornadas informam se a configuração
disponível aceita PIX, boleto, cartão, reembolso e outros recursos.

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

## Receber e validar webhooks

O SDK cria e consulta pagamentos usando a integration key. O endereço que receberá as notificações
é cadastrado no [painel Barzano Pay](https://pay.barzano.com.br/app/integration), na seção
**Webhooks da Account**:

1. informe uma URL HTTPS pública do seu backend;
2. selecione os eventos, como `charge.paid`, `charge.expired` e `charge.failed`;
3. guarde o signing secret, exibido somente na criação ou rotação;
4. implemente uma rota `POST` que preserve o corpo bruto e responda rapidamente com HTTP 2xx.

A Barzano Pay cadastra automaticamente sua própria URL de notificação no provider quando houver
suporte. Você cadastra somente a URL do seu sistema no painel Barzano Pay.

Use o corpo bruto da requisição. Não faça `JSON.parse` antes da validação.

```ts
import {
  verifyWebhook,
  type BarzanoChargeWebhookEvent,
} from '@barzano/pay';

const event: BarzanoChargeWebhookEvent = verifyWebhook({
  payload: rawBody,
  signature: request.headers['x-webhook-signature'],
  timestamp: request.headers['x-webhook-timestamp'],
  secret: process.env.BARZANO_WEBHOOK_SECRET!,
});

switch (event.type) {
  case 'charge.paid':
    await markOrderAsPaid(event.data.externalId);
    break;
  case 'charge.failed':
  case 'charge.expired':
    await reviewOrder(event.data.externalId, event.data.status);
    break;
}
```

O evento validado já é tipado com `chargeId`, `externalId`, `storeExternalId`, valor em centavos,
moeda, status e data de pagamento. Use o header `X-Webhook-Id` ou `event.id` como chave de
idempotência para não processar a mesma notificação duas vezes.

Consulte a [documentação da API](https://pay.barzano.com.br/docs).

Veja também o [mapa de SDKs oficiais](docs/SDK-ROADMAP.md), com a ordem sugerida para Node.js,
Python, .NET, Java e PHP.
