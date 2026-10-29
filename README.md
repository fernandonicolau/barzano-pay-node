# Barzano Pay Node.js SDK

SDK oficial TypeScript para criar e acompanhar pagamentos pela Barzano Pay. A plataforma oferece
um contrato único para sua aplicação integrar meios de pagamento sem acoplar o código diretamente
ao banco ou provider.

- [Conhecer a plataforma e acessar o painel](https://pay.barzano.com.br)
- [Documentação completa da API](https://pay.barzano.com.br/docs)
- [Pacote no npm](https://www.npmjs.com/package/@barzano/pay)

## Guias

- [Início rápido e configuração](docs/GETTING-STARTED.md)
- [Criar e consultar pagamentos](docs/PAYMENTS.md)
- [Receber e validar webhooks](docs/WEBHOOKS.md)
- [Erros, idempotência e observabilidade](docs/ERRORS.md)
- [CLI e configuração assistida](docs/CLI.md)
- [Migração e tipos depreciados](docs/MIGRATION.md)

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

O catálogo publica somente adapters disponíveis no ambiente da sua conta. PagBank, Mercado Pago e
Asaas podem processar PIX conforme as contas financeiras ativas; a Stone permanece fora do catálogo
até concluir a homologação externa. As capabilities informam se cada configuração aceita PIX,
boleto, cartão, reembolso e outros recursos.

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

> **Atenção aos dados do pagador:** em sandbox e produção, envie um CPF/CNPJ matematicamente válido. O documento e o e-mail enviados em
> `payer` devem identificar o comprador e ser diferentes dos dados do estabelecimento recebedor e
> do titular da conta no provider. A API rejeita a cobrança antes de chamar o provider com
> `PAYER_DOCUMENT_MUST_DIFFER_FROM_MERCHANT` ou `PAYER_EMAIL_MUST_DIFFER_FROM_MERCHANT`.

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
    expiresIn: 1800, // o QR Code PIX expira em 30 minutos
    payer: {
      name: 'Cliente Teste',
      email: 'cliente@example.com',
      taxId: '52998224725',
    },
  },
  { idempotencyKey: 'pedido-123-v1' },
);

console.log(payment.pix?.copyAndPaste);
```

Os contratos públicos podem ser importados junto com o cliente. Assim, o TypeScript avisa quando
um campo obrigatório muda e o editor sinaliza aliases antigos com `@deprecated`:

```ts
import {
  BarzanoPay,
  type CreatePaymentInput,
  type PaymentResponse,
  type AnyWebhookEvent,
  type PaymentWebhookEvent,
} from '@barzano/pay';

const input: CreatePaymentInput = {
  externalId: 'pedido-123',
  storeId: 'sua-store-id',
  amount: 200,
  currency: 'BRL',
  method: 'PIX',
  expiresIn: 1800,
  payer: {
    name: 'Cliente Teste',
    email: 'cliente@example.com',
    taxId: '52998224725',
  },
};

const payment: PaymentResponse = await barzano.payments.create(
  input,
  { idempotencyKey: 'pedido-123-v1' },
);
```

Sem `providerCode` ou `paymentAccountReference`, a API usa a conta principal elegível da loja no
mesmo ambiente da integration key. Para escolher um provider, envie o código retornado por
`barzano.providers.list()`. Para escolher uma conta específica, envie sua referência:

```ts
const payment = await barzano.payments.create(
  {
    externalId: 'pedido-124',
    storeId: 'sua-store-id',
    amount: 200,
    currency: 'BRL',
    method: 'PIX',
    providerCode: 'MERCADO_PAGO',
    // Alternativa mais específica: paymentAccountReference: 'uuid-da-conta-financeira',
    payer: {
      name: 'Cliente Teste',
      email: 'cliente@example.com',
      taxId: '52998224725',
    },
  },
  { idempotencyKey: 'pedido-124-v1' },
);
```

A seleção é estrita. Uma conta incompatível, inativa ou de outro ambiente retorna erro; a Barzano
Pay não troca silenciosamente para outro banco.

`CreatePaymentInput` valida os detalhes de cada método: boleto exige `boleto`, cartão exige
`creditCard` e PIX não aceita esses blocos. `PaymentResponse` tipa a resposta normalizada;
`AnyWebhookEvent` e `PaymentWebhookEvent` tipam os eventos recebidos. Os nomes antigos
`Customer`, `Payment` e os tipos iniciados por `Barzano` continuam exportados com
`@deprecated` durante a migração.

## Consultar, sincronizar, cancelar e reembolsar

```ts
const current = await barzano.payments.retrieve(payment.id);
const synchronized = await barzano.payments.sync(payment.id);
const canceled = await barzano.payments.cancel(payment.id);
const refunded = await barzano.payments.refund(payment.id);
const partiallyRefunded = await barzano.payments.refund(payment.id, {
  amount: 500,
  idempotencyKey: 'pedido-123-reembolso-500-v1',
});

const operations = await barzano.payments.listOperations(payment.id);
const operation = await barzano.payments.retrieveOperation(payment.id, operations[0].id);
```

`retrieve` lê o estado persistido; `sync` consulta o provider e atualiza o pagamento; `cancel`
encerra somente pagamentos ainda não pagos. Todas as operações retornam `PaymentResponse` e erros
mantêm `code`, status HTTP e `requestId`.
`refund` devolve integralmente um pagamento pago quando o provider anuncia suporte.
`listOperations` e `retrieveOperation` informam se cancelamentos e reembolsos estão em processamento,
concluídos, falharam ou precisam de reconciliação, sem exigir conhecimento do provider.

O SDK usa o contrato público `POST /api/v1/payments`. Nesse contrato, envie `method`, `payer` e,
para definir a validade do PIX, `expiresIn` em segundos. O endpoint `/api/v1/charges` existe apenas
para integrações antigas e usa `paymentMethod`; não misture os dois formatos. As versões antigas do
SDK que usavam `customer` continuam aceitas e são convertidas para `payer` antes do envio.

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
  type AnyWebhookEvent,
} from '@barzano/pay';

const event: AnyWebhookEvent = verifyWebhook({
  payload: rawBody,
  signature: request.headers['x-webhook-signature'],
  timestamp: request.headers['x-webhook-timestamp'],
  secret: process.env.BARZANO_WEBHOOK_SECRET!,
});

switch (event.type) {
  case 'webhook.test':
    console.log('Entrega de teste recebida', event.id);
    break;
  case 'charge.paid':
    await markOrderAsPaid(event.data.externalId);
    break;
  case 'charge.failed':
  case 'charge.expired':
    await reviewOrder(event.data.externalId, event.data.status);
    break;
}
```

O evento validado já diferencia eventos financeiros de `webhook.test`. Eventos financeiros incluem
`chargeId`, `externalId`, `storeExternalId`, valor em centavos, moeda, status e data de pagamento.
Use o header `X-Webhook-Id` ou `event.id` como chave de
idempotência para não processar a mesma notificação duas vezes.

Consulte a [documentação da API](https://pay.barzano.com.br/docs).

Veja também o [mapa de SDKs oficiais](docs/SDK-ROADMAP.md), com a ordem sugerida para Node.js,
Python, .NET, Java e PHP.
