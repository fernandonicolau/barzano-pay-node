# Webhooks

Cadastre a URL HTTPS pública do seu backend em
[Painel → Webhooks](https://pay.barzano.com.br/app/webhooks). Guarde o signing secret exibido na
criação ou rotação.

Eventos disponíveis:

- `charge.paid`;
- `charge.expired`;
- `charge.failed`;
- `webhook.test`, enviado pelo botão de teste.

## Validação

Preserve o corpo bruto. A assinatura cobre `timestamp.rawBody`; um JSON reserializado pode produzir
outra sequência de bytes.

```ts
import { verifyWebhook, type AnyWebhookEvent } from '@barzano/pay';

const event: AnyWebhookEvent = verifyWebhook({
  payload: rawBody,
  signature: request.headers['x-webhook-signature'],
  timestamp: request.headers['x-webhook-timestamp'],
  secret: process.env.BARZANO_WEBHOOK_SECRET!,
});

switch (event.type) {
  case 'webhook.test':
    break;
  case 'charge.paid':
    await markOrderAsPaid(event.data.externalId);
    break;
  case 'charge.expired':
  case 'charge.failed':
    await reviewOrder(event.data.externalId, event.data.status);
    break;
}
```

## Express

```ts
app.post('/webhooks/barzano', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = verifyWebhook({
    payload: req.body,
    signature: String(req.header('x-webhook-signature')),
    timestamp: String(req.header('x-webhook-timestamp')),
    secret: process.env.BARZANO_WEBHOOK_SECRET!,
  });

  await persistOnce(event.id, event);
  res.sendStatus(204);
});
```

Use `event.id` ou `X-Webhook-Id` para deduplicar. Responda HTTP 2xx depois de persistir o evento.
Falhas são reenviadas e também podem ser reprocessadas pelo painel.
