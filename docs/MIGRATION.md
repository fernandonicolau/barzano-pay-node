# Migração do SDK

## Versão 0.3

Os contratos públicos passaram a usar nomes explícitos e tipos discriminados.

| Antigo | Atual | Situação |
| --- | --- | --- |
| `customer` | `payer` | convertido pelo SDK; depreciado |
| `expiresAt` no request | `expiresIn` em segundos | convertido pelo SDK; depreciado |
| `Payment` | `PaymentResponse` | alias depreciado |
| `Customer` | `Payer` | alias depreciado |
| `BarzanoAnyWebhookEvent` | `AnyWebhookEvent` | alias depreciado |
| `response.chargeId` | `response.id` | campo legado depreciado |
| `response.paymentMethod` | `response.method` | campo legado depreciado |

O TypeScript e o editor mostram `@deprecated` nos nomes antigos. Eles permanecem exportados durante
a migração, portanto a atualização pode ser feita gradualmente.

## Endpoint

Novas integrações usam `barzano.payments`, que chama `/api/v1/payments`. O endpoint
`/api/v1/charges` permanece apenas para clientes antigos e recebe `paymentMethod` em vez de
`method`.
