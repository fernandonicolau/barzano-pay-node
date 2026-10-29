# Erros, idempotência e observabilidade

O SDK lança `BarzanoError` para respostas HTTP e falhas de rede:

```ts
import { BarzanoError } from '@barzano/pay';

try {
  await barzano.payments.create(input, { idempotencyKey: 'pedido-123-v1' });
} catch (error) {
  if (error instanceof BarzanoError) {
    logger.warn({
      code: error.code,
      status: error.status,
      requestId: error.requestId,
    });
  }
}
```

- `code`: código estável para decisão da aplicação;
- `status`: status HTTP; zero representa falha local, timeout ou rede;
- `requestId`: correlação com logs e suporte;
- `details`: detalhes seguros retornados pela API.

Não tome decisões usando somente o texto de `message`.

## Códigos de criação de pagamento

Os providers possuem códigos diferentes. A Barzano Pay converte essas respostas para códigos
estáveis, independentemente do banco selecionado:

| `code`                                     | HTTP | Como corrigir                                                    |
| ------------------------------------------ | ---: | ---------------------------------------------------------------- |
| `INVALID_PAYER_DOCUMENT`                   |  400 | Envie um CPF ou CNPJ matematicamente válido.                     |
| `PAYMENT_DATA_INVALID`                     |  400 | Revise os campos do pagamento e o formato indicado na API.       |
| `PAYMENT_PROVIDER_CONFIGURATION_ERROR`     |  503 | Revise a conta e as credenciais do provider no painel.           |
| `PAYMENT_PROVIDER_TEMPORARILY_UNAVAILABLE` |  503 | Tente novamente mais tarde usando a mesma chave e o mesmo corpo. |
| `IDEMPOTENCY_KEY_REUSED`                   |  409 | Use uma nova chave quando alterar qualquer campo do pagamento.   |
| `PAID_CHARGE_CANNOT_BE_CANCELED`           |  409 | O pagamento já foi pago; não repita o cancelamento.              |
| `CANCEL_TIMEOUT_RECONCILIATION_REQUIRED`   |  504 | Consulte ou sincronize o mesmo pagamento antes de tentar de novo.|

Por exemplo, documento inválido no PagBank, Mercado Pago ou outro provider sempre resulta em
`INVALID_PAYER_DOCUMENT`. O código original permanece somente no diagnóstico interno da Barzano
Pay.

No timeout de cancelamento, não crie outro pagamento nem altere o ID. A API já executa uma
reconciliação segura e o SDK preserva `code` e `requestId` para a aplicação consultar o estado e
acionar o suporte quando necessário.

## Idempotência

Use uma chave diferente por tentativa lógica e repita a mesma chave apenas com o mesmo payload.
Reutilizar a chave com outro payload retorna conflito.

```ts
{ idempotencyKey: `${orderId}-pix-v1` }
```

## Metadados de resposta

```ts
const barzano = new BarzanoPay({
  apiKey: process.env.BARZANO_PAY_API_KEY!,
  onResponse: ({ method, path, status, durationMs, requestId }) => {
    logger.info({ method, path, status, durationMs, requestId });
  },
});
```

O callback não recebe chave, payer ou corpo financeiro.

## Reembolso parcial

O SDK envia `amount` como inteiro em centavos e `Idempotency-Key` no cabecalho. A API pode retornar
`PARTIALLY_REFUNDED`; uma nova devolucao parcial deve usar outra chave.

Codigos estaveis relacionados: `IDEMPOTENCY_KEY_REQUIRED`,
`PARTIAL_REFUND_AMOUNT_MUST_BE_LESS_THAN_PAYMENT`, `PARTIAL_REFUND_NOT_SUPPORTED` e
`REFUND_TIMEOUT_RECONCILIATION_REQUIRED`.
