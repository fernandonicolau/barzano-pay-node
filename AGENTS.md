# AGENTS.md — Barzano Pay Node.js

Antes de executar uma task:

1. leia `../AGENTS.md`;
2. leia `../barzano-pay-back/docs/product-roadmap/README.md` e `STATUS.md`;
3. confira o OpenAPI e o backend antes de alterar tipos ou comportamento;
4. preserve compatibilidade semântica e nunca registre API key, payload ou PII;
5. rode `npm run check` e `npm pack --dry-run`;
6. atualize documentação, versão e publicação somente quando o escopo exigir;
7. use a convenção de commits em português definida no backend.

O SDK expõe o contrato público e facilidades de integração. Regras financeiras, seleção de provider,
idempotência persistida e autenticação humana pertencem ao backend.
