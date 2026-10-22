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

## Consultar e listar

```ts
const payment = await barzano.payments.retrieve('payment-id');

const payments = await barzano.payments.list({
  storeId: 'uuid-da-loja',
  externalId: 'pedido-123',
  status: 'PAID',
  paymentMethod: 'PIX',
  providerCode: 'PAGBANK',
});
```

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
