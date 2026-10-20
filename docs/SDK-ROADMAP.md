# Mapa de SDKs oficiais

Cada linguagem terá um repositório próprio. Isso permite versionamento, dependências, convenções e
publicação independentes sem transformar um SDK em monorepo multilíngue.

| Prioridade | Ecossistema | Repositório sugerido | Distribuição | Escopo inicial |
| ---------- | ----------- | -------------------- | ------------ | -------------- |
| 1 | Node.js / TypeScript | `barzano-pay-node` | npm `@barzano/pay` | SDK, webhooks e CLI de onboarding |
| 2 | Python | `barzano-pay-python` | PyPI `barzano-pay` | SDK síncrono/assíncrono e webhooks |
| 3 | .NET | `barzano-pay-dotnet` | NuGet `Barzano.Pay` | SDK, DI, webhooks e ASP.NET Core |
| 4 | Java | `barzano-pay-java` | Maven Central | SDK, webhooks e integração Spring |
| 5 | PHP | `barzano-pay-php` | Packagist | SDK, webhooks e integração Laravel |

## Critério de priorização

Node.js vem primeiro porque já atende a Barzano Delivery e permite entregar o onboarding por
`npx`. Python e .NET cobrem automações, backends e empresas com forte adoção. Java entra como alvo
oficial para integrações corporativas e Spring. PHP deve ser antecipado se houver demanda de lojas
em Laravel, WooCommerce ou plataformas semelhantes.

## Contrato comum

Todos os SDKs devem ser gerados ou validados contra o mesmo OpenAPI e oferecer o mesmo núcleo:

- autenticação por integration key, sem access token humano no código da aplicação;
- criação e consulta de pagamentos com idempotência;
- tipos para estados, meios de pagamento e erros públicos;
- validação de assinatura e tipagem de webhooks;
- timeouts, retry somente quando seguro e correlação por `requestId`;
- exemplos executáveis e testes de contrato contra sandbox.

O CLI atual pertence ao pacote Node e pode configurar projetos de qualquer linguagem quando Node.js
estiver disponível. Se a demanda exigir instalação sem Node, o caminho recomendado é criar depois um
CLI independente e distribuí-lo como binário, mantendo os SDKs focados no uso em código.

## Critério para iniciar um novo SDK

Um SDK entra em desenvolvimento quando existe ao menos uma integração consumidora real ou demanda
comercial confirmada. Antes da implementação, devem existir OpenAPI estável, matriz de erros públicos,
exemplos de webhook e testes de contrato reutilizáveis. A primeira versão deve cobrir pagamentos e
webhooks; recursos administrativos podem entrar depois.
