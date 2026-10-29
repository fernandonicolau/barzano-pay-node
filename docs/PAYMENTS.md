# Pagamentos

O SDK usa o recurso público `/api/v1/payments`. O domínio interno e os nomes dos eventos ainda usam
`charge`, mas novas integrações devem usar `barzano.payments`, `method` e `payer`.

## PIX

```ts
import type { CreatePaymentInput, PaymentResponse } from '@barzano/pay';

const input: CreatePaymentInput = {
  storeId: 'uuid-da-loja',
  externalId: 'pedido-123',
  amount: 4090,
  currency: 'BRL',
  method: 'PIX',
  expiresIn: 1800,
  payer: {
    name: 'José da Silva',
    email: 'jose@example.com',
    taxId: '52998224725',
  },
};

const payment: PaymentResponse = await barzano.payments.create(
  input,
  { idempotencyKey: 'pedido-123-v1' },
);
```

### Selecionar provider ou conta financeira

O payload financeiro permanece igual para todos os providers. Descubra os providers habilitados e
use o código retornado pelo catálogo:

```ts
const providers = await barzano.providers.list();
const mercadoPago = providers.find((provider) => provider.provider === 'MERCADO_PAGO');

if (!mercadoPago?.capabilities.supportedPaymentMethods.includes('PIX')) {
  throw new Error('Mercado Pago PIX não está disponível nesta conta.');
}

const input: CreatePaymentInput = {
  storeId: 'uuid-da-loja',
  externalId: 'pedido-123-mercado-pago',
  amount: 4090,
  currency: 'BRL',
  method: 'PIX',
  providerCode: mercadoPago.provider,
  payer: {
    name: 'José da Silva',
    email: 'jose@example.com',
    taxId: '52998224725',
  },
};
```

- omita os dois campos para usar a conta principal elegível da loja;
- use `providerCode` para selecionar uma conta ativa daquele provider;
- use `paymentAccountReference` para selecionar exatamente uma conta financeira;
- não envie configuração, token ou payload específico do banco na cobrança;
- a API nunca faz fallback silencioso quando a seleção explícita é inválida.

O ambiente vem da integration key. Uma chave Sandbox nunca seleciona conta de Produção e vice-versa.

## Boleto

```ts
const payment = await barzano.payments.create(
  {
    storeId: 'uuid-da-loja',
    externalId: 'pedido-124',
    amount: 4090,
    currency: 'BRL',
    method: 'BOLETO',
    payer: {
      name: 'José da Silva',
      email: 'jose@example.com',
      taxId: '52998224725',
    },
    boleto: {
      dueDate: '2026-10-30',
      holderAddress: {
        street: 'Avenida Paulista',
        number: '1000',
        locality: 'Bela Vista',
        city: 'São Paulo',
        region: 'São Paulo',
        regionCode: 'SP',
        country: 'BRA',
        postalCode: '01310100',
      },
    },
  },
  { idempotencyKey: 'pedido-124-v1' },
);
```

## Cartão

O cartão deve chegar tokenizado ou criptografado pelo provider. Não envie PAN ou CVV em texto puro.

```ts
const payment = await barzano.payments.create(
  {
    storeId: 'uuid-da-loja',
    externalId: 'pedido-125',
    amount: 4090,
    currency: 'BRL',
    method: 'CREDIT_CARD',
    payer: {
      name: 'José da Silva',
      email: 'jose@example.com',
      taxId: '52998224725',
    },
    creditCard: {
      token: 'token-seguro-do-provider',
      installments: 1,
      save: false,
    },
  },
  { idempotencyKey: 'pedido-125-v1' },
);
```

## Consultar, sincronizar, cancelar, reembolsar e listar

```ts
const payment = await barzano.payments.retrieve('payment-id');

// Consulta o provider e persiste o estado mais recente antes de responder.
const synchronized = await barzano.payments.sync('payment-id');

// Cancela uma cobrança ainda não paga e devolve o estado normalizado.
const canceled = await barzano.payments.cancel('payment-id');

// Reembolsa integralmente uma cobrança paga.
const refunded = await barzano.payments.refund('payment-id');

const partiallyRefunded = await barzano.payments.refund('payment-id', {
  amount: 500,
  idempotencyKey: 'pedido-125-reembolso-500-v1',
});

const payments = await barzano.payments.list({
  storeId: 'uuid-da-loja',
  externalId: 'pedido-123',
  status: 'PAID',
  paymentMethod: 'PIX',
  providerCode: 'PAGBANK',
});
```

`retrieve` lê o estado persistido na Barzano Pay. Use `sync` quando precisar reconciliar
imediatamente com o provider; webhooks continuam sendo a fonte principal das atualizações.

O cancelamento é permitido somente enquanto o pagamento não tiver sido pago. Se a resposta for
`CANCEL_TIMEOUT_RECONCILIATION_REQUIRED`, a Barzano Pay já consultou o provider antes de encerrar a
requisição e não enviou uma segunda ordem de cancelamento. Consulte `retrieve` e, se necessário,
execute `sync` com o mesmo ID antes de decidir a próxima ação.

## Estado de cancelamentos e reembolsos

```ts
const operations = await barzano.payments.listOperations('payment-id');
const operation = await barzano.payments.retrieveOperation('payment-id', operations[0].id);
```

O estado canônico pode ser `PROCESSING`, `SUCCEEDED`, `FAILED` ou
`REQUIRES_RECONCILIATION`. Consulte a mesma operação em vez de enviar novamente uma solicitação
monetária quando o resultado ainda não for conclusivo.

O reembolso integral é idempotente e só é aceito para pagamentos com status `PAID` em providers
que anunciam `supportsRefund`. Reembolso parcial exige valor inteiro em centavos, Idempotency-Key e
capability `supportsPartialRefund`.

## Resposta

`PaymentResponse` inclui `id`, `externalId`, `status`, valor, método, expiração, provider,
instruções e `nextAction`. Use o discriminador `nextAction.type`:

```ts
if (payment.nextAction.type === 'DISPLAY_QR_CODE') {
  showPix(payment.nextAction.qrCode, payment.nextAction.qrCodeImageUrl);
}

if (payment.nextAction.type === 'DISPLAY_BOLETO') {
  showBoleto(payment.nextAction.digitableLine, payment.nextAction.documentUrl);
}
```

O CPF/CNPJ precisa ser matematicamente válido. O documento e o e-mail do pagador precisam identificar o comprador e ser diferentes dos dados do
estabelecimento e do titular da conta no provider.

## Reembolso parcial

Use `payments.refund(paymentId, { amount, idempotencyKey })`. `amount` e sempre um inteiro em
centavos e deve ser menor que o valor original. A chave e obrigatoria e deve identificar a tentativa
logica de devolucao; reutilize-a somente ao repetir exatamente o mesmo reembolso. Consulte
`supportsPartialRefund` no catalogo antes de oferecer a operacao.
