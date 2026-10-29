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

## Gate de sincronização do contrato

Endpoint, DTO, enum, erro público ou autenticação alterados no backend exigem, na mesma task:

1. conferir o OpenAPI publicado e a documentação em `/docs`;
2. atualizar os tipos públicos e métodos do SDK sem inventar campos;
3. atualizar exemplos, erros, migração e versão do pacote;
4. adicionar teste que prove método, path, payload, resposta, código e `requestId` relevantes;
5. executar `npm run check` e `npm pack --dry-run` antes de publicar.

O SDK e `/docs` são projeções do OpenAPI do backend. Se qualquer uma divergir, a task permanece
`PARTIAL` e a nova API não deve ser anunciada nem publicada como concluída.
