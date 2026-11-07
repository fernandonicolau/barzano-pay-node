# Checkout integrado de cartão no navegador

O submódulo `@barzano/pay/browser` mantém o formulário dentro do delivery e traduz a saída dos SDKs
oficiais para o contrato da Barzano Pay. Ele não cria cobranças e nunca deve receber integration key,
Access Token do provider ou qualquer outro segredo do servidor.

```bash
npm install @barzano/pay@0.10.0
```

## Fluxo seguro

1. o backend do integrador entrega ao navegador somente a chave **pública** da conta financeira;
2. o navegador monta o Brick oficial ou criptografa o cartão localmente;
3. `@barzano/pay/browser` devolve somente `creditCard.token` ou `creditCard.encrypted`;
4. o navegador envia esse fragmento ao backend do integrador;
5. o backend adiciona `payer`, `storeId`, valor e idempotência e chama a Barzano Pay com a integration key.

PAN, CVV, integration key e Access Token do provider não podem aparecer juntos na mesma requisição,
log ou ferramenta de observabilidade.

## Mercado Pago

Prepare um elemento vazio e monte o Card Payment Brick. `amount` usa centavos, como o restante da API
Barzano; o kit converte para reais somente ao inicializar o Brick.

```html
<div id="mercado-pago-card"></div>
```

```ts
import { mountMercadoPagoCard } from '@barzano/pay/browser';

const controller = await mountMercadoPagoCard({
  publicKey: 'APP_USR-chave-publica',
  containerId: 'mercado-pago-card',
  amount: 4090,
  onSubmit: async ({ providerCode, creditCard }) => {
    await fetch('/checkout/card', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerCode, creditCard }),
    });
  },
  onError: ({ code, message }) => {
    // Exiba uma mensagem segura. Não anexe campos do cartão ao seu log.
    console.error(code, message);
  },
});

// Em React, Vue ou outra SPA, desmonte ao sair da tela.
await controller.unmount();
```

O resultado possui este formato:

```json
{
  "providerCode": "MERCADO_PAGO",
  "creditCard": {
    "checkoutMode": "EMBEDDED",
    "token": "token-de-uso-unico",
    "paymentMethodId": "master",
    "installments": 2
  }
}
```

## PagBank

O PagBank não hospeda os campos do formulário nesse fluxo: a interface pertence ao integrador e o
SDK oficial criptografa os dados localmente. Execute a função apenas no envio do formulário, limpe os
campos sensíveis depois da resposta e envie somente o resultado normalizado ao seu backend.

```ts
import { encryptPagBankCard } from '@barzano/pay/browser';

const result = await encryptPagBankCard({
  publicKey: 'chave-publica-da-conta-pagbank',
  holder: form.holder.value,
  number: form.number.value,
  expMonth: form.expMonth.value,
  expYear: form.expYear.value,
  securityCode: form.securityCode.value,
  installments: 2,
});

await fetch('/checkout/card', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(result),
});

form.reset();
```

O resultado contém `providerCode = PAGBANK` e apenas o valor `creditCard.encrypted` de uso único.

## Backend do integrador

Valide o provider permitido para o pedido e crie a cobrança com o cliente Node. Não aceite valor,
`storeId` ou conta financeira definidos livremente pelo navegador.

```ts
import { BarzanoPay } from '@barzano/pay';

const payment = await barzano.payments.create({
  externalId: order.id,
  storeId: order.storeId,
  amount: order.totalInCents,
  currency: 'BRL',
  method: 'CREDIT_CARD',
  providerCode: body.providerCode,
  payer: order.payer,
  creditCard: body.creditCard,
}, { idempotencyKey: `order:${order.id}:payment:1` });
```

## Requisitos de produção

- sirva o checkout exclusivamente em HTTPS;
- aplique CSP permitindo os domínios oficiais dos SDKs e evite `unsafe-inline` sempre que possível;
- não instale session replay, analytics ou captura automática nos campos de cartão;
- não persista nem imprima PAN, CVV, token ou valor criptografado;
- trate token e criptograma como valores descartáveis e tente novamente com um novo valor;
- valide no sandbox casos aprovado, recusado, expirado, idempotente e atualização por webhook;
- confirme com seu responsável de segurança e adquirente o escopo PCI DSS aplicável ao seu formulário.

O kit reduz o acoplamento e evita que dados brutos cheguem à Barzano Pay, mas não substitui a
avaliação PCI DSS do integrador, especialmente no formulário próprio do PagBank.

## Página local de homologação

No repositório do SDK, execute:

```bash
npm run example:mercado-pago-card
```

Abra a URL exibida pelo Vite, informe somente a Public Key sandbox e o valor. A página usa o mesmo
`mountMercadoPagoCard` exportado pelo pacote e mostra apenas o fragmento seguro que deve seguir para
o backend do integrador. Gere um token novo a cada tentativa.
