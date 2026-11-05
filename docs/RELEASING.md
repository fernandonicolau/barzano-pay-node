# Publicar o SDK

A próxima publicação é a `0.10.0`. As versões intermediárias locais não precisam ser publicadas:
o npm aceita publicar diretamente a versão estável mais recente, desde que `0.10.0` ainda não exista.

## Gate antes da publicação

```bash
npm ci
npm run check
npm pack --dry-run
npm view @barzano/pay versions --json
```

Confirme também que backend, OpenAPI, portal e SDK descrevem o mesmo contrato e que os testes
sandbox de cartão foram concluídos. Não inclua chaves, `.env`, cartões ou respostas sensíveis no
pacote.

## Publicação posterior

1. revisar e integrar o commit da versão `0.10.0`;
2. criar a tag exata `v0.10.0` no commit aprovado;
3. enviar a tag ao GitHub;
4. acompanhar o workflow **Publish npm package**;
5. validar `npm view @barzano/pay version` e instalar em um projeto vazio.

O workflow recusa tags diferentes da versão do `package.json` e publica com proveniência. Não execute
`npm publish` manualmente na máquina de desenvolvimento.
