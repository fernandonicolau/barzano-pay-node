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
